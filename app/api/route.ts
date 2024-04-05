import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const CONNECTION_STRING = process.env["CONNECTION_STRING"];

/**
 * The timeseries is binned to organize the data.
 * @param minDate 
 * @param stride 
 * @returns 
 */
function summaryRowsSql(minDate: Date, stride: string) {
    return `
        WITH avgs AS (
            SELECT
                date_bin('${stride}'::interval, ts, '2024-03-01'::timestamp) as initial_timestamp,
                AVG(cold_query_ms) as avg_duration
            FROM benchmarks
            WHERE ts > '${minDate.toISOString()}' AND driver = 'node-postgres (Client)'
            GROUP BY initial_timestamp
        )
        SELECT
            initial_timestamp,
            AVG(avg_duration)
        FROM avgs
        GROUP BY initial_timestamp
        ORDER BY initial_timestamp DESC;
    `;
}

/**
 * The timeseries is binned to organize the data.
 * @param minDate 
 * @param stride 
 * @returns 
 */
function branchRowsSql(minDate: Date, stride: string) {
    return `
        WITH avgs AS (
            SELECT
                branch_id as id,
                date_bin('${stride}'::interval, ts, '2024-03-01'::timestamp) as ts,
                AVG(cold_query_ms) as avg_duration
            FROM benchmarks
            WHERE ts > '${minDate.toISOString()}' AND driver = 'node-postgres (Client)'
            GROUP BY id, ts
        )
        SELECT
            id,
            AVG(avg_duration) AS duration,
            ts
        FROM avgs
        GROUP BY id, ts
        ORDER BY ts DESC;
    `;
}

function hotStartTimesSql (minDate: Date) {
    return `
      SELECT
          br.ts,
          b.branch_id,
          AVG(unnest_hot_query) AS avg_hot_start_time
      FROM
          benchmark_runs br
      JOIN
          benchmarks b ON br.id = b.benchmark_run_id,
          unnest(b.hot_queries_ms) AS unnest_hot_query
      WHERE
        br.ts > '${minDate.toISOString()}'
      GROUP BY
          br.id,
          b.branch_id
      ORDER BY
          br.ts;
    `;
}

/**
 * Return all the projects, their operations, and the related endpoint (using the connection string in the env var.)
 * @returns 
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('query');

    if (!CONNECTION_STRING) {
        return NextResponse.json({ error: 'Database url is missing.' }, { status: 500 });
    };

    const sql = neon(CONNECTION_STRING);

    const today = new Date();
    let stride = "30 minutes";
    switch (query) {
        case 'day':
            today.setDate(today.getDate() - 1);
            break;
        case 'week':
            today.setDate(today.getDate() - 7);
            stride = "60 minutes";
            break;
        case 'month':
            today.setDate(today.getDate() - 30);
            stride = "120 minutes";
            break;
        default:
            return NextResponse.json({ error: 'Invalid query filter.' }, { status: 500 })
    }

    const branches = await sql`SELECT id, name, description FROM branches;`;
    const summaryRows = await sql(summaryRowsSql(today, stride));
    const rows = await sql(branchRowsSql(today, stride));
    const hotStartTimes = await sql(hotStartTimesSql(today));
    const hotDataPoints = hotStartTimes.map(x => ({
      x: x.ts,
      y: Number(x.avg_hot_start_time),
      id: x.branch_id,
    }));
    const dataPoints = rows.map(x => ({
        x: x.ts,
        y: Number(x.duration),
        id: x.id,
    }));
    const summary = summaryRows.map(x => ({
        x: x.ts,
        y: Number(x.avg),
    }))

    return NextResponse.json({
        data: {
            hotDataPoints,
            dataPoints,
            branches,
            summary
        }
    }, {
        status: 200,
        headers: {
            'Cache-Control': 'public, s-maxage=1',
            'CDN-Cache-Control': 'public, s-maxage=60',
            'Vercel-CDN-Cache-Control': 'public, s-maxage=3600',
        },
    },);
}
