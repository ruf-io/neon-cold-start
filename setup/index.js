const { Pool } = require("pg");
const { createApiClient } = require("@neondatabase/api-client");
const { readFileSync } = require("fs");

require('dotenv').config();
const configFile = JSON.parse(readFileSync(__dirname + "/config.json", "utf-8"));

/**
 * Benchmark database
 */
const API_KEY = process.env["API_KEY"];
const PROJECT_NAME = process.env["PROJECT_NAME"] || "Benchmark";
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
            console.error(err);
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
    console.log("Reading benchmark config.");
    const configMap = {};
    configFile.branches.forEach(branch => { configMap[branch.name.replace(/\s+/g, '_').toLowerCase()] = branch; });

    // Get branches IDs.
    console.log("Retrieving branches data.");
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
    console.log("Endpoint ID:", endpointId);
    let suspended = false;
    while (!suspended) {
        try {
            await apiClient.suspendProjectEndpoint(projectId, endpointId);
            suspended = true;
        } catch (err) {
            console.error("Error suspending project. Trying again in 500ms.")
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
 * @param {Object} config An object containing the branchs' configuration.
 * @param {Object} apiClient The API client used to communicate with the backend services.
 * @returns {Promise<void>} A promise that resolves when the benchmarking process is complete,
 * indicating that no value is returned but the side effects (benchmarking the project) have been completed.
 */
const benchmarkProject = async ({ id: projectId }, config, apiClient) => {
    console.log("Starting benchmark.");
    await waitProjectOpFinished(apiClient, projectId);
    const mainConfig = config[MAIN_BRANCH_NAME];
    const mainPool = new Pool({
        host: mainConfig.endpoint.host,
        password: mainConfig.password,
        user: ROLE_NAME,
        database: DATABASE_NAME,
        ssl: true,
    });
    const insertPromises = [];

    // The initial time is used to identify and group the benchmarks as a summary.
    const initialTime = new Date();

    for (const branchName of Object.keys(config)) {
        const {
            endpoint: benchmarkEndpoint,
            password: benchmarkRolePassword,
            benchmarkQuery,
            id: branchId
        } = config[branchName];

        // Main branch doesn't need a benchmark.
        if (branchName === "main") {
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

            await benchmarkPool.query(benchmarkQuery);
            const after = new Date();
            const benchmarkValue = after.getTime() - before.getTime();
            benchmarkPool.end();

            // Store benchmark
            insertPromises.push(
                mainPool.query(
                    "INSERT INTO benchmarks VALUES ($1, $2, $3, now())",
                    [branchId, initialTime, benchmarkValue]
                )
            );

            // Save computing time
            await waitProjectOpFinished(apiClient, projectId);
            await suspendProjectEndpoint(apiClient, projectId, benchmarkEndpoint.id);
        }

        // Sleep 30 seconds before the next benchmark
        await new Promise((res, ) => setTimeout(() => res(), 30000));
    }

    await Promise.all(insertPromises);
    mainPool.end();
}

exports.handler = async () => {
    if (!API_KEY) {
        throw new Error("API KEY is missing.");
    }

    const apiClient = createApiClient({
        apiKey: API_KEY,
    });
    const project = await getProject(apiClient);
    const config = await getConfig(apiClient, project.id);
    await benchmarkProject(project, config, apiClient);
}