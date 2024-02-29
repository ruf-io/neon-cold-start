const { Pool } = require("pg");
const { createApiClient } = require("@neondatabase/api-client");
const { parse } = require("pg-connection-string");
require('dotenv').config();

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
 * Initializes the project and its branches required for benchmarking. This function is responsible
 * for setting up any necessary infrastructure, configurations, or data needed to benchmark the project.
 * 
 * IMPORTANT: This function will fail if you already have a project in a free account.
 * Ensure you have no projects set up before initializing a new one.
 * Otherwise, upgrading to a paid account will resolve the issue. 
 * 
 * @param {Object} apiClient The API client used to interact with Neon.
 * @returns {Promise<void>} A promise that resolves once the project and its branches are ready.
 */
const initProject = async (apiClient) => {
    console.log("Initializing a new benchmark project on :", PROJECT_REGION);

    // Create the project
    const { data: createProjectData } = await apiClient.createProject({
        project: {
            name: PROJECT_NAME,
            region_id: PROJECT_REGION,
            branch: {
                role_name: ROLE_NAME,
                database_name: DATABASE_NAME
            },
        }
    });
    const {
        connection_uris: mainConnectionUris,
        project
    } = createProjectData;
    const { id: projectId } = project;
    const { connection_uri: mainConnectionUri } = mainConnectionUris.pop();

    // Create the table to store the benchmarks.
    // Using the connect uri in the Pool fails, but using the parse fixes the issue.
    const config = parse(mainConnectionUri);
    const mainPool = new Pool(config);
    await mainPool.query("CREATE TABLE IF NOT EXISTS benchmarks (id TEXT, duration INT, ts TIMESTAMP);");

    // Create the benchmark branch to do the benchmarks.
    const { data: benchmarkBranchData } = await apiClient.createProjectBranch(projectId, {
        branch: {
            name: BENCHMARK_BRANCH_NAME,
            role_name: ROLE_NAME,
            database_name: DATABASE_NAME,
        },
        endpoints: [{
            type: "read_write"
        }]
    });
    const { connection_uris: benchmarkConnectionUris } = benchmarkBranchData;
    const { connection_uri: benchmarkConnectionUri } = benchmarkConnectionUris.pop();

    const benchmarkConfig = parse(benchmarkConnectionUri);
    // Create the table storing a series of numbers.
    // 
    // The benchmark will measure how much does it take to query this table.
    const benchmarkPool = new Pool(benchmarkConfig);
    await benchmarkPool.query("CREATE TABLE IF NOT EXISTS series (serie_num INT);");
    await benchmarkPool.query("INSERT INTO series VALUES (generate_series(0, 100000));");
    await benchmarkPool.query("CREATE INDEX IF NOT EXISTS series_idx ON series (serie_num);");
    benchmarkPool.end();

    return project;
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
    const { branches } = (await apiClient.listProjectBranches(projectId)).data;
    const mainBranch = branches.find(x => x.name === MAIN_BRANCH_NAME);
    const benchmarkBranch = branches.find(x => x.name === BENCHMARK_BRANCH_NAME);

    if (!mainBranch) {
        throw new Error("Main branch is missing.");
    } else if (!benchmarkBranch) {
        throw new Error("Benchmark branch is missing.");
    }

    // Get endpoints and passwords.
    const mainRolePasswordPromise = apiClient.getProjectBranchRolePassword(projectId, mainBranch.id, ROLE_NAME);
    const benchmarkRolePasswordPromise = apiClient.getProjectBranchRolePassword(projectId, benchmarkBranch.id, ROLE_NAME);
    const mainEndpointPromise = apiClient.listProjectBranchEndpoints(projectId, mainBranch.id);
    const benchmarkEndpointPromise = apiClient.listProjectBranchEndpoints(projectId, benchmarkBranch.id);
    const [
        { data: mainRolePassword },
        { data: benchmarkRolePassword },
        { data: mainEndpointsData },
        { data: benchmarkEndpointsData },
    ] = await Promise.all([
        mainRolePasswordPromise,
        benchmarkRolePasswordPromise,
        mainEndpointPromise,
        benchmarkEndpointPromise
    ]);

    const { endpoints: mainEndpoints } = mainEndpointsData;
    const { endpoints: benchmarkEndpoints } = benchmarkEndpointsData;
    return {
        endpoints: {
            main: mainEndpoints[0],
            benchmark: benchmarkEndpoints[0]
        },
        passwords: {
            main: mainRolePassword.password,
            benchmark: benchmarkRolePassword.password
        }
    };
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
const benchmarkProject = async ({ id: projectId }, {
    endpoints: {
        benchmark: benchmarkEndpoint,
        main: mainEndpoint
    },
    passwords: {
        benchmark: benchmarkRolePassword,
        main: mainRolePassword
    }
}, apiClient) => {
    console.log("Starting benchmark.");

    await waitProjectOpFinished(apiClient, projectId);

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
    const mainPool = new Pool({
        host: mainEndpoint.host,
        password: mainRolePassword,
        user: ROLE_NAME,
        database: DATABASE_NAME,
        ssl: true,
    });
    await mainPool.query("INSERT INTO benchmarks VALUES ($1, $2, now())", [projectId, benchmarkValue])
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
            console.log("Benchmark project not found.")
            project = await initProject(apiClient);
        }

        const config = await getConfig(apiClient, project.id);
        await benchmarkProject(project, config, apiClient);
    } catch (err) {
        console.log(err);
        throw err;
    }
}