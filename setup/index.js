const { Pool } = require("pg");
const { createApiClient } = require("@neondatabase/api-client");
const { parse } = require("pg-connection-string");
require('dotenv').config();
const config = readFileSync(__dirname + "/config.json", "utf-8");

/**
 * Benchmark database
 */
const API_KEY = process.env["API_KEY"];
const PROJECT_REGION = process.env["PROJECT_REGION"] || "aws-us-east-1";
const PROJECT_NAME = process.env["PROJECT_NAME"] || "Benchmark";
const DATABASE_NAME = process.env["DATABASE_NAME"] || "neondb";
const ROLE_NAME = process.env["ROLE_NAME"] || "BenchmarkRole";
const BENCHMARK_BRANCH_NAME = process.env["BENCHMARK_BRANCH_NAME"] || "Benchmarks";
const MAIN_BRANCH_NAME = process.env["BENCHMARK_BRANCH_NAME"] || "main";

/**
 * Fetches all items from a paginated request from Neon.
 * @param {Function} apiFunction - The API client function to call. It should accept an object as its only argument.
 * @param {Object} initialParams - Initial parameters to pass to the API function.
 * @param {Function} itemKeyExtractor - Key for items from the API response.
 * @returns {Promise<void>}
 */
const fetchAllItems = async (apiFunction, baseParams, itemKey) => {
    const baseItems = [];
    let params = { ...baseParams, };
    let continueFetching = true;

    while (continueFetching) {
        const response = await apiFunction(params);
        const items = response.data[itemKey];
        const cursor = response.pagination && response.pagination.cursor;

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
 * Retrieves the configuration necessary to run benchmarks, including endpoints and role passwords for both the main and benchmark branches.
 * 
 * @param {Object} apiClient The API client used to communicate with the backend.
 * @param {string} projectId The unique identifier for the project.
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 * - `endpoints`: The endpoint URL for the main and benchmark branch.
 * - `password`: The role password for the main and benchmark role.
 */
const getConfig = async (apiClient, projectId) => {
    console.log("Retrieving benchmark config.");

    // Get branches IDs.
    const { data: listBranchesData } = await apiClient.listProjectBranches(projectId);
    const { branches } = listBranchesData;
    const branchesConfig = {};
    const promises = [];

    for ({ id: branchId, name: branchName } of branches) {
        branchesConfig[branchName] = {};
        const { data: rolePasswordData } = await apiClient.getProjectBranchRolePassword(projectId, branchId, ROLE_NAME);
        const { password } = rolePasswordData;
        branchesConfig[branchName]["password"] = password;

        const { data: endpointData } = await apiClient.listProjectBranchEndpoints(projectId, branchId);
        const { endpoints: branchEndpoints } = endpointData;
        branchesConfig[branchName]["endpoint"] = branchEndpoints[0];
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

        // Sleep.
        await new Promise((res) => { setTimeout(res, 500) });
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
 * @returns {Promise<void>} A promise that resolves once the endpoint has been successfully suspended.
 */
const suspendProjectEndpoint = async (apiClient, projectId, endpointId) => {
    let suspended = false;
    while (!suspended) {
        try {
            console.log("Project ID:", projectId);
            await apiClient.suspendProjectEndpoint(projectId, endpointId);
            suspended = true;
        } catch (err) {
            console.error("Error suspending project.")
            console.error(JSON.stringify(err));
            // Sleep.
            await new Promise((res) => { setTimeout(res, 500) });
        }
    }
}

/**
 * Benchmarks the project. This process involves temporarily suspending
 * the project's endpoint and then running a benchmark query to assess performance.
 * The project's endpoint is suspended again after the benchmarking is completed.
 * 
 * @param {Object} project An object containing the project's details.
 * @param {Object} config An object containing the configuration details for benchmarking.
 * @param {Object} apiClient The API client used to communicate with the backend services.
 * @returns {Promise<void>} A promise that resolves when the benchmarking process is complete,
 * indicating that no value is returned but the side effects (benchmarking the project) have been completed.
 */
const benchmarkProject = async ({ id: projectId }, config, apiClient) => {
    console.log("Starting benchmark.");
    await waitProjectOpFinished(apiClient, projectId);
    const mainConfig = config[MAIN_BRANCH_NAME];
    console.log(mainConfig)
    const mainPool = new Pool({
        host: mainConfig.endpoint.host,
        password: mainConfig.password,
        user: ROLE_NAME,
        database: DATABASE_NAME,
        ssl: true,
    });
    const insertPromises = [];

    for (const branchName of Object.keys(config)) {
        const {
            endpoint: benchmarkEndpoint,
            password: benchmarkRolePassword
        } = config[branchName];

        // Main branch doesn't need a benchmark.
        if (branchName === "main") {
            mainConfig = {
                benchmarkEndpoint,
                benchmarkRolePassword,
            };
            continue;
        } else {
            console.log("Benchmarking branch: ", branchName);

            // Ensure the endpoint is idle (suspended.)
            if (benchmarkEndpoint.current_state !== "idle") {
                console.log("Benchmark endpoint was not idle. Suspending endpoint.");
                await suspendProjectEndpoint(apiClient, projectId, benchmarkEndpoint.id);
                await waitEndpointIdle(apiClient, projectId, benchmarkEndpoint.id);
            }

            // Run benchmark
            const before = new Date();
            const benchmarkPool = new Pool({
                host: benchmarkEndpoint.host,
                password: benchmarkRolePassword,
                user: ROLE_NAME,
                database: DATABASE_NAME,
                ssl: true,
            });
            await benchmarkPool.query("SELECT * FROM series WHERE serie_num = 1000000;");
            const after = new Date();
            const benchmarkValue = after.getTime() - before.getTime();
            benchmarkPool.end();

            // Store benchmark
            insertPromises.push(
                mainPool.query(
                    "INSERT INTO benchmarks VALUES ($1, $2, now())",
                    [projectId, benchmarkValue]
                )
            );
        }
    }

    await Promise.all(insertPromises);
    mainPool.end();

    // Save computing time
    await waitProjectOpFinished(apiClient, projectId);
    await suspendProjectEndpoint(apiClient, projectId, benchmarkEndpoint.id);
}

exports.handler = async () => {
    if (!API_KEY) {
        throw new Error("API KEY is missing.");
    }

    const apiClient = createApiClient({
        apiKey: API_KEY,
    });

    try {
        const projects = await fetchProjects(apiClient);
        let project = projects.find(x => x.name === PROJECT_NAME);

        if (!project) {
            throw new Error("Benchmark project not found.");
        }

        const config = await getConfig(apiClient, project.id);
        await benchmarkProject(project, config, apiClient);
    } catch (err) {
        console.log(err);
        throw err;
    }
}