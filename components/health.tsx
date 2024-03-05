import React from "react";

interface Props {
    health: number;
}

const Health = (props: Props) => {
    return (
        <div className="grid grid-cols-10 grid-rows-1 gap-x-3 h-1">
            <div className="col-span-2 rounded-xl border border-gray-700 bg-green-600 bg-opacity-70"></div>
            <div className="col-span-2 rounded-xl border border-gray-700"></div>
            <div className="col-span-2 rounded-xl border border-gray-700"></div>
            <div className="col-span-2 rounded-xl border border-gray-700"></div>
            <div className="col-span-2 rounded-xl border border-gray-700"></div>
        </div>
    );
};

export default Health;