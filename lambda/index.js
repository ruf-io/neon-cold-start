const { Pool } = require("pg");
const { createApiClient } = require("@neondatabase/api-client");

/**
 * Benchmark database
 */
const API_KEY = process.env["API_KEY"];
const PROJECT_NAME = process.env["PROJECT_NAME"] || "Benchmark";
const DATABASE_NAME = process.env["DATABASE_NAME"] || "neondb";
const ROLE_NAME = process.env["ROLE_NAME"] || "BenchmarkRole";

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
    // Create the project
    const { data } = await apiClient.createProject({
        project: {
            name: PROJECT_NAME,
            region_id: "aws-us-east-1",
            branch: {
                role_name: ROLE_NAME,
                database_name: DATABASE_NAME
            },
        }
    });
    const { branch: mainBranch, connection_uris: mainConnectionUris } = data
    const { connection_uri: mainConnectionUri } = mainConnectionUris.pop();

    // Create the table to store the benchmarks.
    const mainPool = new Pool(mainConnectionUri);
    await mainPool.query("CREATE TABLE IF NOT EXISTS benchmarks (id TEXT, duration INT, ts TIMESTAMP);");


    // Create the additional branch to do the benchmarks.
    const { data: benchmarkBranchData } = await apiClient.createProjectBranch(project.id, {
        branch: {
            name: "Benchmarks",
            role_name: ROLE_NAME,
            database_name: DATABASE_NAME,
        }
    });
    const { connection_uris: benchmarkConnectionUris } = benchmarkBranchData;
    const { connection_uri: benchmarkConnectionUri } = benchmarkConnectionUris.pop();
    await apiClient.createProject({
        project: {
            branch: {
                role_name: ROLE_NAME,
                database_name: DATABASE_NAME,
            }
        }
    });
    // Create the table storing a series of numbers.
    // 
    // The benchmark will measure how much does it take to query this table.
    const benchmarkPool = new Pool(benchmarkConnectionUri);
    await benchmarkPool.query("CREATE TABLE IF NOT EXISTS series (serie_num INT);");
    await benchmarkPool.query("INSERT INTO series VALUES (generate_series(0, 100000));");
    await benchmarkPool.query("CREATE INDEX IF NOT EXISTS series_idx ON series (serie_num);");
    benchmarkPool.end();
}

const getConfig = async (apiClient) => {
    const mainRolePasswordPromise = apiClient.getProjectBranchRolePassword(projectId, mainBranch.id, ROLE_NAME);
    const benchmarkRolePasswordPromise = apiClient.getProjectBranchRolePassword(projectId, benchmarkBranch.id, ROLE_NAME);
    const mainEndpointPromise = apiClient.listProjectBranchEndpoints(projectId, mainBranch.id);
    const benchmarkEndpointPromise = apiClient.listProjectBranchEndpoints(projectId, benchmarkBranch.id);
    const [
        {
            data: mainRolePassword
        },
        {
            data: benchmarkRolePassword
        },
        {
            data: mainEndpoints
        },
        {
            data: benchmarkEndpoints
        },
    ] = await Promise.all([
        mainRolePasswordPromise,
        benchmarkRolePasswordPromise,
        mainEndpointPromise,
        benchmarkEndpointPromise
    ]);

    return {
        mainHost: mainEndpoints[0].host,
        benchmarkHost: benchmarkEndpoints[0].host,
        mainRolePassword: mainRolePassword.password,
        benchmarkRolePassword: benchmarkRolePassword.password
    };
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
const benchmarkProject = async ({ id: projectId }, {
    mainHost,
    benchmarkHost,
    mainRolePassword,
    benchmarkRolePassword
}, apiClient) => {
    await waitProjectOpFinished(apiClient, projectId);
    const { current_state } = benchmarkEndpoint;

    if (current_state !== "idle") {
        // TODO: Retry in case of failure.
        await apiClient.suspendProjectEndpoint(projectId, endpointId);
        await waitEndpointIdle(apiClient);
    }

    // Run benchmark
    const before = new Date();
    const benchmarkPool = new Pool({
        host: benchmarkHost,
        password: benchmarkRolePassword,
        user: ROLE_NAME,
        database: DATABASE_NAME,
        ssl: true,
    });
    await benchmarkPool.query("SELECT * FROM benchmark_big_table WHERE a = 1000000;");
    const after = new Date();
    const benchmarkValue = after.getTime() - before.getTime();
    benchmarkPool.end();

    // Store benchmark
    const mainPool = new Pool({
        host: mainHost,
        password: mainRolePassword,
        user: ROLE_NAME,
        database: DATABASE_NAME,
        ssl: true,
    });
    await mainPool.query("INSERT INTO benchmarks VALUES ($1, $2, now())", [projectId, benchmarkValue])
    mainPool.end();

    // Save computing time
    await waitProjectOpFinished(apiClient, projectId);
    await apiClient.suspendProjectEndpoint(projectId, endpointId);
}


exports.handler = async () => {
    const apiClient = createApiClient({
        apiKey: API_KEY,
    });

    try {
        const projects = await fetchProjects();
        let project = projects.find(x => x.name === PROJECT_NAME);

        if (!project) {
            await initProject(project, apiClient);
        }

        const { branches } = (await apiClient.listProjectBranches(projectId)).data;
        const mainBranch = branches.find(x => x.name === "main");
        const benchmarkBranch = branches.find(x => x.name === "Benchmark");

        if (!mainBranch || !benchmarkBranch) {
            throw new Error("Missing branches for benchmark.");
        }
        const config = await getConfig();

        await benchmarkProject(projects, config, apiClient);
    } catch (err) {
        console.log(err);
    }
}