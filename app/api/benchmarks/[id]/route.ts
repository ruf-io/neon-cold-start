import { NextRequest, NextResponse } from 'next/server';
import { NEON_CONNECTION_STRING, neonApiClient, waitEndpointIdle, waitProjectOpFinished } from '../../utils';
import { neon } from '@neondatabase/serverless';

const benchmarkQuery = "SELECT * FROM benchmark_big_table WHERE a = 1000000;";

/**
 * Runs a benchmark. 
 * 
 * This function will suspend the compute, run the benchmark query,
 * and store the results. 
 * 
 * @param { id: string, projectId: string, endpointId: string } 
 * @returns { { data: { id: string, benchmarkValue: number }} }
 */
export async function POST(req: NextRequest) {
    const { id, projectId, endpointId } = await req.json();

    if (!NEON_CONNECTION_STRING) {
        return NextResponse.json({ error: 'Neon DB URL is missing.' }, { status: 500 });
    } else if (!projectId) {
        return NextResponse.json({ error: 'Project ID is missing.' }, { status: 500 });
    } else if (!endpointId) {
        return NextResponse.json({ error: 'Endpoint ID is missing.' }, { status: 500 });
    } else if (!id) {
        return NextResponse.json({ error: 'Benchmark ID is missing.' }, { status: 500 });
    }

    console.log("Wait op finish.")
    // Running an operation while another is running errs.
    await waitProjectOpFinished(projectId);

    const endpoint = await neonApiClient.getProjectEndpoint(projectId, endpointId);
    if (endpoint.data.endpoint.current_state !== "idle") {
        console.log("Suspending endpoint.")

        let tryCount = 0;
        while (tryCount < 3) {
            tryCount += 1;
            try {
                console.log("Suspending endpoint. Try: ", tryCount);
                // Suspend endpoint.
                await neonApiClient.suspendProjectEndpoint(projectId, endpointId);
                break;
            } catch (err) {
                console.error(err);
                await new Promise((res) => setTimeout(() => res(true), 1000));
            }
        }
    } else {
        console.log("Endpoint is already suspended.");
    }
    const sql = neon(NEON_CONNECTION_STRING);

    console.log("Wait endpoint idle.")
    // Wait until the endpoint is idle.
    await waitEndpointIdle(projectId, endpointId);

    // Run select operation to trigger compute.
    const before = new Date();
    await sql(benchmarkQuery);
    const after = new Date();
    const benchmarkValue = after.getTime() - before.getTime();

    await sql`INSERT INTO benchmarks VALUES (${id}, ${benchmarkValue}, now())`;

    return NextResponse.json({
        data: {
            id,
            benchmarkValue,
        }
    }, { status: 200 });
}

/**
 * Get runs from a particular benchmark.
 * @param _ 
 * @param context 
 * @returns all the runs for a particular benchmark. 
 */
export async function GET(_: NextRequest, context: any) {
    const { id } = context.params;

    if (!NEON_CONNECTION_STRING) {
        return NextResponse.json({ error: 'Neon DB URL is missing.' }, { status: 500 });
    } else if (!id) {
        return NextResponse.json({ error: 'Benchmark ID is missing.' }, { status: 500 });
    };

    const sql = neon(NEON_CONNECTION_STRING);

    const benchmarks = await sql`SELECT * FROM benchmarks WHERE id = ${id} ORDER BY TS ASC`;

    return NextResponse.json({
        data: {
            benchmarks
        }
    }, { status: 200 });
}
