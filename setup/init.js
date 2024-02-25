const { Pool } = require("pg");
const { createApiClient } = require("@neondatabase/api-client");
const { parse } = require("pg-connection-string");
require('dotenv').config("../");

/**
 * Benchmark database
 */
const API_KEY = process.env["API_KEY"];
const PROJECT_NAME = process.env["PROJECT_NAME"] || "Benchmark";
const DATABASE_NAME = process.env["DATABASE_NAME"] || "neondb";
const ROLE_NAME = process.env["ROLE_NAME"] || "BenchmarkRole";
const BENCHMARK_BRANCH_NAME = process.env["BENCHMARK_BRANCH_NAME"] || "Benchmarks";

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
    if (!API_KEY) {
        throw new Error("The API Key is missing. Make sure to declare it in your environment variables.");
    }
    console.log("Initializing a new benchmark project.");

    // Create the project
    const { data: createProjectData } = await apiClient.createProject({
        project: {
            name: PROJECT_NAME,
            region_id: "aws-us-east-1",
            branch: {
                role_name: ROLE_NAME,
                database_name: DATABASE_NAME,
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
    mainPool.end();

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

    console.log("**IMPORTANT**");
    console.log("\nAdd the following variable to your `.env` file:");
    console.log(`NEON_CONNECTION_STRING=${mainConnectionUri.trim()}`);

    return project;
}

const apiClient = createApiClient({
    apiKey: API_KEY,
});
initProject(apiClient);