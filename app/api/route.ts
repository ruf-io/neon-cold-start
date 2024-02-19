import { NextRequest, NextResponse } from 'next/server';
import { NEON_API_KEY, NEON_CONNECTION_STRING } from './utils';
import { neon } from '@neondatabase/serverless';

/**
 * Valid set of filters for the query.
 */
const filters = new Set(["day", "week", "month"]);

/**
 * Return all the projects, their operations, and the related endpoint (using the connection string in the env var.)
 * @returns 
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('query');

    if (!NEON_API_KEY) {
        return NextResponse.json({ error: 'API KEY is missing.' }, { status: 500 });
    };

    if (!NEON_CONNECTION_STRING) {
        return NextResponse.json({ error: 'Database url is missing.' }, { status: 500 });
    };

    const sql = neon(NEON_CONNECTION_STRING);
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
            break;
    }

    const rows = await sql`SELECT duration, ts FROM benchmarks WHERE ts > ${today.toISOString()} ORDER BY ts DESC;`;
    const dataPoints = rows.map(x => ({
        x: x.ts,
        y: x.duration,
    }));

    return NextResponse.json({
        data: {
            dataPoints
        }
    }, { status: 200 });
}