import { NextRequest, NextResponse } from 'next/server';
import { neonApiClient, NEON_API_KEY } from '../../utils';

export async function GET(req: NextRequest) {
    if (!NEON_API_KEY) {
        return NextResponse.json({ error: 'API KEY is missing.' }, { status: 500 });
    };

    const { projectId } = await req.json();
    const endpoints = (await neonApiClient.listProjectEndpoints(projectId)).data.endpoints;

    return NextResponse.json({
        data: {
            endpoints
        }
    }, { status: 200 });
}