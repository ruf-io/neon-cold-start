import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const CONNECTION_STRING = process.env["CONNECTION_STRING"];

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

    // The SQL interval is not usable here because parametrizing it causes an error.
    const today = new Date();
    switch (query) {
        case 'day':
            today.setDate(today.getDate() - 1);
            break;
        case 'week':
            today.setDate(today.getDate() - 7);
            break;
        case 'month':
            today.setDate(today.getDate() - 30);
            break;
        default:
            return NextResponse.json({ error: 'Invalid query filter.' }, { status: 500 })
    }

    const branches = await sql`SELECT id, name, description FROM branches;`;
    const summaryRows = await sql`SELECT initial_timestamp, AVG(duration) FROM benchmarks WHERE initial_timestamp > ${today.toISOString()} GROUP BY initial_timestamp ORDER BY initial_timestamp DESC;`;
    const rows = await sql`SELECT id, duration, ts FROM benchmarks WHERE ts > ${today.toISOString()} ORDER BY ts DESC;`;
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