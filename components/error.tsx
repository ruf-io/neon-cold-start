import React from "react";

interface Props {
    message: string;
}

const Error = (props: Props) => {
    return (
        <div className="rounded-md border border-gray-800 bg-gray-50 bg-opacity-5 p-4">
            <div className="flex">
                <div className="flex-shrink-0">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-red-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                </div>
                <div className="ml-3">
                    <h3 className="text-sm font-medium text-white">There was an error processing your request.</h3>
                </div>
            </div>
        </div>
    );
}

export default Error;