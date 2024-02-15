import { NextRequest, NextResponse } from 'next/server';
import { NEON_CONNECTION_STRING } from '../../utils';
import { neon } from '@neondatabase/serverless';

// TODO: Solve type in context
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