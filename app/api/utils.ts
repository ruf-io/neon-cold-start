export interface Response<T> {
    data: T;
};

export const NEON_CONNECTION_STRING = process.env["NEON_CONNECTION_STRING"];