const { Pool: PgPool, Client: PgClient } = require("pg");
const { neonConfig, Client: NeonClient } = require("@neondatabase/serverless");
const { createApiClient } = require("@neondatabase/api-client");
const { readFileSync } = require("fs");
const { randomUUID } = require("crypto");
const { default: PQueue } = require('p-queue');

neonConfig.webSocketConstructor = require('ws')

require('dotenv').config();
const configFile = JSON.parse(readFileSync(__dirname + "/config.json", "utf-8"));

/**
 * Drivers
 * @type {{NODE_POSTGRES: {name: string, Client: PgClient}, NEON_SERVERLESS: {name: string, Client: NeonClient}}}
 */
const DRIVERS = {
    NODE_POSTGRES_CLIENT: {
        name: "node-postgres (Client)",
        Client: PgClient,
    },
    NEON_SERVERLESS_CLIENT: {
        name: "@neondatabase/serverless (Client)",
        Client: NeonClient,
    }
}

/**
 * Benchmark database
 */
const API_KEY = process.env["API_KEY"];
const PROJECT_NAME = process.env["PROJECT_NAME"] || "QueryLatencyBenchmarks";
const DATABASE_NAME = process.env["DATABASE_NAME"] || "neondb";
const ROLE_NAME = process.env["ROLE_NAME"] || "BenchmarkRole";
const MAIN_BRANCH_NAME = process.env["BENCHMARK_BRANCH_NAME"] || "main";

/**
 * Fetches all items from a paginated request from Neon.
 * @param {Function} apiFunction - The API client function to call. It should accept an object as its only argument.
 * @param {Object} initialParams - Initial parameters to pass to the API function.
 * @param {Function} itemKey - Key for items from the API response.
 * @returns {Promise<void>}
 */
const fetchAllItems = async (apiFunction, baseParams, itemKey) => {
    const baseItems = [];
    let params = { ...baseParams, };
    let continueFetching = true;

    while (continueFetching) {
        try {

            const response = await apiFunction(params);
            const items = response.data[itemKey];
            const cursor = (response.pagination && response.pagination.cursor) ||
                (response.data.pagination && response.data.pagination.cursor);

            if (items.length > 0) {
                baseItems.push(...items);
            } else {
                continueFetching = false;
            }

            if (cursor && Array.isArray(items) && items.length > 0) {
                params = { ...params, cursor };
            } else {
                continueFetching = false;
            }
        } catch (err) {
            log(err);
        }
    }

    return baseItems;
};

/**
 * Returns all available projects in the account.
 */
const fetchProjects = async (apiClient) => {
    return await fetchAllItems(apiClient.listProjects, {}, "projects");
}

/**
 * Returns shared projects in the account.
 */
const fetchSharedProjects = async () => {
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${API_KEY}`);
    headers.set("Accept", "application/json");
    headers.set("Content-Type", "application/json");

    const response = await fetch("https://console.neon.tech/api/v2/projects/shared", {
        headers
    });
    const { projects } = await response.json();

    return projects;
}

/**
 * Searches the configured project.
 * @param {*} apiClient 
 * @returns project.
 */
const getProject = async (apiClient) => {
    const projects = await fetchProjects(apiClient);
    let project = projects.find(x => x.name === PROJECT_NAME);

    if (!project) {
        let projects = await fetchSharedProjects();
        project = projects.find(x => x.name === PROJECT_NAME);

        if (!project) {
            throw new Error("Benchmark project not found.");
        }
    }

    return project;
}

/**
 * Retrieves the configuration necessary to run benchmarks, including endpoints and role passwords for both the main and benchmark branches.
 * 
 * @param {Object} apiClient The API client used to communicate with the backend.
 * @param {string} projectId The unique identifier for the project.
 * @returns {Promise<Object>} A promise that resolves to an object containing each branch configuration.
 */
const getConfig = async (apiClient, projectId) => {
    log("Reading benchmark config.");
    const configMap = {};
    configFile.branches.forEach(branch => { configMap[branch.name.replace(/\s+/g, '_').toLowerCase()] = branch; });

    // Get branches IDs.
    log("Retrieving branches data.");
    const { data: listBranchesData } = await apiClient.listProjectBranches(projectId);
    const { branches } = listBranchesData;
    // console.log("Branches: ", branches);
    const branchesConfig = {};

    for ({ id: branchId, name: branchName } of branches) {
        const { data: rolePasswordData } = await apiClient.getProjectBranchRolePassword(projectId, branchId, ROLE_NAME);
        const { password } = rolePasswordData;

        const { data: endpointData } = await apiClient.listProjectBranchEndpoints(projectId, branchId);
        const { endpoints: branchEndpoints } = endpointData;
        const endpoint = branchEndpoints[0];

        if (branchName !== MAIN_BRANCH_NAME) {
            branchesConfig[branchName] = {
                password,
                endpoint,
                benchmarkQuery: configMap[branchName].benchmarkQuery,
                id: branchId
            };
        } else {
            branchesConfig[branchName] = {
                password,
                endpoint,
                benchmarkQuery: "",
                id: branchId
            };
        }
    }

    return branchesConfig;
}

/**
 * Waits until an endpoint is idle.
 */
const waitEndpointIdle = async (apiClient, projectId, endpointId) => {
    let idle = false;
    while (!idle) {
        const endpoint = await apiClient.getProjectEndpoint(projectId, endpointId);
        idle = endpoint.data.endpoint.current_state === "idle";

        await sleep(500)
    }
}

/**
 * Waits until the latest project operation is finish.
 * @param {*} apiClient 
 * @param {*} projectId 
 */
const waitProjectOpFinished = async (apiClient, projectId) => {
    let finished = false;

    while (!finished) {
        const projectOpsStatus = (await apiClient.listProjectOperations({ projectId })).data.operations[0].status;
        finished = projectOpsStatus === "finished";

        // Sleep.
        await new Promise((res) => { setTimeout(res, 500) });
    }
}

/**
 * Suspends a specific project endpoint. This function is used to temporarily deactivate
 * the benchmark endpoint. Suspending an endpoint can raise errors if other operations are happening
 * at the same time. To ensure the endpoint is idle, the function will retry until successful.
 * 
 * @param {Object} apiClient The API client used to interact with Neon.
 * @param {string} projectId The ID of the project for which the endpoint will be suspended.
 * @param {string} endpointId The ID of the endpoint to be suspended within the specified project.
 * @param {number} sleepTimeMs The time to sleep after suspending the endpoint (default: 60000ms).
 * @returns {Promise<void>} A promise that resolves once the endpoint has been successfully suspended.
 */
const suspendProjectEndpoint = async (apiClient, projectId, endpointId, sleepTimeMs = 60000) => {
    log(`Suspend endpoint with ID ${endpointId}`);
    let suspended = false;
    while (!suspended) {
        try {
            await apiClient.suspendProjectEndpoint(projectId, endpointId);
            suspended = true;
            log(`Endpoint suspended: ${endpointId}`);
        } catch (err) {
            log(`Error suspending endpoint ${endpointId}. Trying again in 5000ms.`)
            log(`Error: ${err}`)
            await sleep(5000);
        }
    }

    // Sleep for the given time to ensure the endpoint is idle and avoid a
    // prolonged cold start when the endpoint is queried again 
    log(`Sleeping for ${sleepTimeMs / 1000} seconds to give the endpoint ${endpointId} time to idle.`)
    await sleep(sleepTimeMs);
}

/**
 * Creates a unique benchmark run record in the database to identify the current benchmark run.
 * @param {Object} apiClient The API client used to interact with Neon.
 * @param {string} projectId The ID of the project for which the endpoint will be suspended.
 * @param {String} runId An identifier for the current benchmark run.
 */
async function createBenchmarkRun (apiClient, projectId, runId) {
  const config = await getConfig(apiClient, projectId);

  const mainConfig = config[MAIN_BRANCH_NAME];

  const client = new PgClient({
      host: mainConfig.endpoint.host,
      password: mainConfig.password,
      user: ROLE_NAME,
      database: DATABASE_NAME,
      ssl: true,
  });

  await client.connect();

  log(`Creating benchmark run record in the database with ID ${runId}.`)

  await client.query(`INSERT INTO benchmark_runs (id, ts) VALUES ($1, $2);`, [runId, new Date()]);
  await client.end();
}

/**
 * Benchmarks the project. This process involves temporarily suspending
 * the project's endpoint and then running a benchmark query to assess performance.
 * The project's endpoint is suspended again after the benchmarking is completed.
 * 
 * @param {Object} project An object containing the project's details.
 * @param {Object} apiClient The API client used to communicate with the backend services.
 * @param {Object} driver The driver used to connect to the database.
 * @param {String} runId An identifier for the current benchmark run.
 * @returns {Promise<void>} A promise that resolves when the benchmarking process is complete,
 * indicating that no value is returned but the side effects (benchmarking the project) have been completed.
 */
const benchmarkProject = async ({ id: projectId }, apiClient, driver, runId) => {
    const benchQueue = new PQueue({ concurrency: 1 });
    log(`Starting benchmark for project ${projectId} using driver ${driver.name}.`);

    // Use the Pool constructor from the given driver to create a connection pool
    const BenchmarkClient = driver.Client;

    // Get the project/branch configuration and details
    const config = await getConfig(apiClient, projectId);

    await waitProjectOpFinished(apiClient, projectId);
    const mainConfig = config[MAIN_BRANCH_NAME];
    const client = new PgClient({
        host: mainConfig.endpoint.host,
        password: mainConfig.password,
        user: ROLE_NAME,
        database: DATABASE_NAME,
        ssl: true,
    });

    client.on('error', (err) => {
      log('Main client error:')
      log(err)
    });

    await client.connect();

    Object.keys(config).forEach(async (branchName) => {
        benchQueue.add(async () => {
            if (branchName === "main") {
                // Skip the main branch.
                return;
            }

            const {
                id: branchId,
                endpoint: benchmarkEndpoint,
                password: benchmarkRolePassword,
                benchmarkQuery
            } = config[branchName];
    
            
            // Ensure the endpoint is idle (suspended.)
            if (benchmarkEndpoint.current_state !== "idle") {
                await suspendProjectEndpoint(apiClient, projectId, benchmarkEndpoint.id);
                await waitEndpointIdle(apiClient, projectId, benchmarkEndpoint.id);
            }
            
            log(`Benchmarking branch ${branchName} with endpoint ${benchmarkEndpoint.id} with driver ${driver.name}.`)
    
            // Run benchmarks

            // Cold Starts
            const coldTimeStart = Date.now();
            const benchClient = new BenchmarkClient({
                host: benchmarkEndpoint.host,
                password: benchmarkRolePassword,
                user: ROLE_NAME,
                database: DATABASE_NAME,
                ssl: true,
            });
            await benchClient.connect();
            await benchClient.query(benchmarkQuery);
            const coldQueryMs = Date.now() - coldTimeStart;

            // Hot Queries (where the connection is already active)
            const hotQueryTimes = []
            for (let i = 0; i < 10; i++) {
                const start = Date.now();
                await benchClient.query(benchmarkQuery);
                hotQueryTimes.push(Date.now() - start);
            }
            await benchClient.end();
            
            // Hot Queries (where the connection is already active)
            const hotConnectQueryTimes = []
            for (let i = 0; i < 10; i++) {
                const start = Date.now();
                const benchClient = new BenchmarkClient({
                    host: benchmarkEndpoint.host,
                    password: benchmarkRolePassword,
                    user: ROLE_NAME,
                    database: DATABASE_NAME,
                    ssl: true,
                });
                await benchClient.connect();
                await benchClient.query(benchmarkQuery);
                hotConnectQueryTimes.push(Date.now() - start);
                await benchClient.end();
            }
            
            log(`Benchmark complete. Details ${branchName} / ${benchmarkEndpoint.id} / ${driver.name}. Cold ${coldQueryMs} / Hot Connect ${hotConnectQueryTimes.join(',')} / Hot ${hotQueryTimes.join(',')}`)

            await client.query(
                "INSERT INTO benchmarks (branch_id, cold_start_connect_query_response_ms, hot_connect_query_response_ms, hot_query_response_ms, ts, driver, benchmark_run_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                [branchId, coldQueryMs, hotConnectQueryTimes, hotQueryTimes, new Date(), driver.name, runId]
            )
    
            await suspendProjectEndpoint(apiClient, projectId, benchmarkEndpoint.id, 5000);
        });
    })

    await benchQueue.onIdle();

    log(`Finished benchmarking project using driver ${driver.name}.`)

    await client.end();
}

function log (str) {
    console.log(`${new Date().toJSON()}: ${str}`);
}

function sleep (time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

exports.handler = async () => {
    if (!API_KEY) {
        throw new Error("API KEY is missing.");
    }

    const drivers = Object.values(DRIVERS).map(x => x.name).join(", ");
    const apiClient = createApiClient({
        apiKey: API_KEY,
    });

    const project = await getProject(apiClient);
    const runId = randomUUID()

    await createBenchmarkRun(apiClient, project.id, runId);

    log(`Starting benchmarking (ID: ${runId}) drivers ${drivers}`)
    await benchmarkProject(project, apiClient, DRIVERS.NODE_POSTGRES_CLIENT, runId);
    
    log('Waiting 1 minute before testing next driver...')
    await sleep(60 * 1000)

    await benchmarkProject(project, apiClient, DRIVERS.NEON_SERVERLESS_CLIENT, runId);
    log(`Finished benchmarking (ID: ${runId}) drivers ${drivers}`)
}
