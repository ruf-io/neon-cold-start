const { Pool } = require("pg");
const { createApiClient } = require("@neondatabase/api-client");

/**
 * Benchmark database
 */
const CONNECTION_STRING = process.env["CONNECTION_STRING"];
const API_KEY = process.env["API_KEY"];
const PROJECT_NAME = "Benchmark";

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
 * Fetches all available projects in a Neon'n account.
 */
const fetchProjects = async (apiClient) => {
    return await fetchAllItems(apiClient.listProjects, {}, "projects");
}

/**
 * Inits the project and branches needed for the benchmark.
 * @param {*} project 
 * @param {*} apiClient 
 */
const initProject = async (project, apiClient) => {
    await apiClient.createProject({
        project: {
            name: "Benchmark",
            region_id: "aws-us-east-1",
            branch: "main",
        }
    });
    project = createProjectData.project;
    const { connection_uri: mainConnectionUri } = data.connection_uris.pop();
    const mainPool = new Pool(mainConnectionUri);
    await mainPool.query("CREATE TABLE IF NOT EXISTS benchmarks (id TEXT, duration INT, ts TIMESTAMP);");

    const { data } = await apiClient.createProjectBranch(project.id, {
        branch: {
            name: "Benchmarks"
        }
    });
    const { connection_uri: benchmarkConnectionUri } = connection_uris.pop();

    const benchmarkPool = new Pool(benchmarkConnectionUri);
    await benchmarkPool.query("CREATE TABLE IF NOT EXISTS series (serie_num INT);");
    await benchmarkPool.query("INSERT INTO series VALUES (generate_series(0, 100000));");
    await benchmarkPool.query("CREATE INDEX IF NOT EXISTS series_idx ON series (serie_num);");

    benchmarkPool.end();
}

/**
 * Waits until an endpoint is idle.
 */
const waitEndpointIdle = async (apiClient) => {
    let idle = false;
    while (!idle) {
        console.log("Checking project endpoint.")
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
 * Benchmark projects.
 * 
 * Benchmarks a Neon's project.
 * This will suspend the project endpoint (compute,)
 * and run a query to benchmark and resume the endpoint.
 * 
 * At the end it will suspend the project endpoint again.
 */
const benchmarkProject = async ({ id: projectId }, apiClient) => {
    const endpoints = (await apiClient.listProjectEndpoints(projectId)).data.endpoints;

    for ({ id: endpointId } of endpoints) {
        await waitProjectOpFinished(apiClient, projectId);
        const endpoint = await apiClient.getProjectEndpoint(projectId, endpointId);
        const { host, current_state } = endpoint.data.endpoint;

        if (current_state !== "idle") {
            await apiClient.suspendProjectEndpoint(projectId, endpointId);
            await waitEndpointIdle(apiClient);
        }

        const pool = new Pool(CONNECTION_STRING);

        const before = new Date();
        await pool.query("SELECT * FROM benchmark_big_table WHERE a = 1000000;");
        const after = new Date();
        const benchmarkValue = after.getTime() - before.getTime();
        await pool.query("INSERT INTO benchmarks VALUES ($1, $2, now())", [projectId, benchmarkValue])
        await pool.end();

        // Save computing time
        await waitProjectOpFinished(apiClient, projectId);
        await apiClient.suspendProjectEndpoint(projectId, endpointId);
    }
}


exports.handler = async () => {
    const apiClient = createApiClient({
        apiKey: API_KEY,
    });

    try {
        const projects = await fetchProjects();
        let project = projects.find(x => x.name === PROJECT_NAME);
        apiClient.listProjectBranchEndpoints(projectId, branchId);

        if (!project) {
            await initProject(project, apiClient);
        }
        const branches = await apiClient.listProjectBranches(projectId);

        await benchmarkProject(projects, apiClient);
    } catch (err) {
        console.log(err);
    }
}