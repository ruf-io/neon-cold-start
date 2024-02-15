import { createApiClient } from "@neondatabase/api-client";

export interface Response<T> {
    data: T;
};

export const NEON_CONNECTION_STRING = process.env["NEON_CONNECTION_STRING"];
export const NEON_API_KEY = process.env["NEON_API_KEY"];
export const neonApiClient = createApiClient({
    apiKey: NEON_API_KEY || "",
});

/**
 * Fetches all items from a paginated request from Neon.
 * @param {Function} apiFunction - The API client function to call. It should accept an object as its only argument.
 * @param {Object} initialParams - Initial parameters to pass to the API function.
 * @param {Function} itemKeyExtractor - Key for items from the API response.
 * @returns {Promise<void>}
 */
export const fetchAllItems = async (apiFunction: Function, baseParams: any, itemKey: string) => {
    const baseItems = [];
    let params = { ...baseParams, };
    let continueFetching = true;

    while (continueFetching) {
        const response = await apiFunction(params);
        const items = response.data[itemKey];
        const cursor = response.pagination && response.pagination.cursor;

        if (items.length > 0) {
            baseItems.push(...items);
        } else {
            continueFetching = false;
        }

        if (cursor && Array.isArray(items) && items.length > 0) {
            params = { ...params, cursor };
        } else {
            continueFetching = false;
        }
    }

    return baseItems;
};

/**
 * Wait until the last proejct operation is finished.
 * @param projectId 
 */
export const waitProjectOpFinished = async (projectId: string) => {
    let finished = false;
    console.log("Checking project's last operation status.");

    while (!finished) {
        // Retrieve last operation.
        const projectOpsStatus = (await neonApiClient.listProjectOperations({ projectId })).data.operations[0].status;
        finished = projectOpsStatus === "finished";

        // Sleep.
        await new Promise((res) => { setTimeout(res, 500) });
    }
}

/**
 * Waits until an endpoint is idle.
 */
export const waitEndpointIdle = async (projectId: string, endpointId: string) => {
    let idle = false;
    while (!idle) {
        const endpoint = await neonApiClient.getProjectEndpoint(projectId, endpointId);
        idle = endpoint.data.endpoint.current_state === "idle";

        // Sleep.
        await new Promise((res) => { setTimeout(res, 500) });
    }
}