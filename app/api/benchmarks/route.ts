import { NextRequest, NextResponse } from 'next/server';
import { NEON_CONNECTION_STRING } from '../utils';
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

/**
 * Start up queries.
 * 
 * These queries will run when initializing a new benchmark.
 */
const startUpQueries = [
    "CREATE TABLE IF NOT EXISTS benchmarks (id TEXT, duration INT, ts TIMESTAMP);",
    "CREATE TABLE IF NOT EXISTS benchmark_table (A INT);",
    "INSERT INTO benchmark_table VALUES (generate_series(0, 100000))",
    "CREATE INDEX IF NOT EXISTS benchmark_table_idx ON benchmark_table (A);"
];

/**
 * Initializes a benchmark and returns its ID.
 * 
 * A benchmark run 
 * @param req 
 * @returns 
 */
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
    const benchmarkId = randomUUID();

    if (init) {
        console.log("Initializing branch database.");

        for (const query of startUpQueries) {
            await sql(query)
        }
    }

    return NextResponse.json({
        data: {
            id: benchmarkId
        }
    }, { status: 200 });
}

/**
 * Get all the benchmarks from a branch with their stats sorted by timestamp.
 * @returns benchmarks and their stats.
 */
export async function GET() {
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