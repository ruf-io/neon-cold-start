import { NextRequest, NextResponse } from 'next/server';
import { NEON_CONNECTION_STRING, neonApiClient, waitEndpointIdle, waitProjectOpFinished } from '../utils';
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

/**
 * Start up queries
 */
const startUpQueries = [
    "CREATE TABLE IF NOT EXISTS benchmarks (id TEXT, duration INT, ts TIMESTAMP);",
    "CREATE TABLE IF NOT EXISTS benchmark_table (A INT);",
    "INSERT INTO benchmark_table VALUES (generate_series(0, 100000))",
    "CREATE INDEX IF NOT EXISTS benchmark_table_idx ON benchmark_table (A);"
];

const benchmarkQuery = "SELECT * FROM benchmark_big_table WHERE a = 1000000;";

// TODO: Separate init from benchmark
export async function POST(req: NextRequest) {
    const { init, id, projectId, endpointId } = await req.json();

    if (!NEON_CONNECTION_STRING) {
        return NextResponse.json({ error: 'Neon DB URL is missing.' }, { status: 500 });
    } else if (!projectId) {
        return NextResponse.json({ error: 'Project ID is missing.' }, { status: 500 });
    } else if (!endpointId) {
        return NextResponse.json({ error: 'Endpoint ID is missing.' }, { status: 500 });
    } else if (!init && !id) {
        return NextResponse.json({ error: 'Benchmark ID is missing.' }, { status: 500 });
    }
    const sql = neon(NEON_CONNECTION_STRING);
    const benchmarkId = id || randomUUID();

    if (init) {
        console.log("Initializing branch database.");

        for (const query of startUpQueries) {
            await sql(query)
        }
    }

    console.log("Wait op finish.")
    // Running an operation while another is running errs.
    await waitProjectOpFinished(projectId);

    const endpoint = await neonApiClient.getProjectEndpoint(projectId, endpointId);
    if (endpoint.data.endpoint.current_state !== "idle") {
        console.log("Suspending endpoint.")
        // Suspend endpoint.
        await neonApiClient.suspendProjectEndpoint(projectId, endpointId);
    } else {
        console.log("Endpoint is already suspended.");
    }

    console.log("Wait endpoint idle.")
    // Wait until the endpoint is idle.
    await waitEndpointIdle(projectId, endpointId);

    // Run select operation to trigger compute.
    const before = new Date();
    await sql(benchmarkQuery);
    const after = new Date();
    const benchmarkValue = after.getTime() - before.getTime();

    await sql`INSERT INTO benchmarks VALUES (${benchmarkId}, ${benchmarkValue}, now())`;

    return NextResponse.json({
        data: {
            id: benchmarkId
        }
    }, { status: 200 });
}

export async function GET(req: NextRequest) {
    if (!NEON_CONNECTION_STRING) {
        return NextResponse.json({ error: 'Neon DB URL is missing.' }, { status: 500 });
    }

    const sql = neon(NEON_CONNECTION_STRING);
    const benchmarks = await sql`SELECT id, MIN(ts) as ts, AVG(duration), MAX(duration), MIN(duration) FROM benchmarks GROUP BY id ORDER BY ts DESC;`;
    return NextResponse.json({
        data: {
            // Avg can turn into a string.
            benchmarks: benchmarks.map(x => ({
                ...x,
                avg: Number(Number(x.avg).toFixed(0))
            }))
        }
    }, { status: 200 });
}