import { Endpoint, Project } from '@neondatabase/api-client';
import { NextResponse } from 'next/server';
import { fetchAllItems, neonApiClient, NEON_API_KEY, NEON_CONNECTION_STRING } from './utils';
import { parse } from 'pg-connection-string';

/**
 * Return all the projects, their operations, and the related endpoint (using the connection string in the env var.)
 * @returns 
 */
export async function GET() {
    if (!NEON_API_KEY) {
        return NextResponse.json({ error: 'API KEY is missing.' }, { status: 500 });
    };

    if (!NEON_CONNECTION_STRING) {
        return NextResponse.json({ error: 'Database url is missing.' }, { status: 500 });
    };

    const projects: Array<Project> = await fetchAllItems(neonApiClient.listProjects, {}, "projects");
    const projectEndpointsPromise = projects.map(x => neonApiClient.listProjectEndpoints(x.id));
    const operationsPerProjectPromise = projects.map(x => fetchAllItems(neonApiClient.listProjectOperations, { projectId: x.id }, "operations"));
    const operations = await Promise.all(operationsPerProjectPromise);
    const projectEndpoints = await Promise.all(projectEndpointsPromise);

    const { host: hostWithoutCleaning } = parse(NEON_CONNECTION_STRING);
    if (!hostWithoutCleaning) {
        return NextResponse.json({ error: 'Host is missing from database url.' }, { status: 500 });
    }

    // The host available in the endpoint is not the pooler.
    const host = hostWithoutCleaning.replace("-pooler", "");
    let endpoint;
    projectEndpoints.forEach(({ data }) => {
        const { endpoints } = data;
        return endpoints.forEach((x: Endpoint) => {
            if (x.host === host) {
                endpoint = x;
            }
        });
    });

    return NextResponse.json({
        data: {
            operations,
            projects,
            endpoint,
        }
    }, { status: 200 });
}