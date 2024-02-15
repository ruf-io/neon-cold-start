import { NextRequest, NextResponse } from 'next/server';
import { neonApiClient, NEON_API_KEY } from '../utils';

export async function GET(req: NextRequest) {
    if (!NEON_API_KEY) {
        return NextResponse.json({ error: 'API KEY is missing.' }, { status: 500 });
    };

    const { endpointId, projectId } = await req.json();
    const endpoint = await neonApiClient.getProjectEndpoint(projectId, endpointId);

    return NextResponse.json({
        data: {
            endpoint
        }
    }, { status: 200 });
}