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
                initial_timestamp,
                duration as avg_duration
            FROM benchmarks
            WHERE ts > '${minDate.toISOString()}'
        )
        SELECT
            initial_timestamp,
            avg_duration as avg
        FROM avgs
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
                id,
                date_bin('${stride}'::interval, initial_timestamp, '2024-03-01'::timestamp) as initial_timestamp,
                AVG(duration) as avg_duration
            FROM benchmarks
            WHERE initial_timestamp > '${minDate.toISOString()}'
            GROUP BY id, initial_timestamp
        )
        SELECT
            id,
            AVG(avg_duration) AS duration,
            initial_timestamp AS ts
        FROM avgs
        GROUP BY id, initial_timestamp
        ORDER BY initial_timestamp DESC;
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
    const dataPoints = rows.map(x => ({
        x: x.ts,
        y: Number(x.duration),
        id: x.id,
    }));
    const summary = summaryRows.map(x => ({
        x: x.initial_timestamp,
        y: Number(x.avg),
    }))

    return NextResponse.json({
        data: {
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