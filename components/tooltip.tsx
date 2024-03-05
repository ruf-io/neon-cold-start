import React, { PropsWithChildren } from "react";

interface Props extends PropsWithChildren {
    message?: string | JSX.Element;
}

const Tooltip = ({ message, children }: Props) => {
    return (
        <div className="group relative flex">
            {children}
            <span className="absolute w-48 max-w-48 top-8 scale-0 transition-all rounded bg-gray-800 p-2 text-xs text-white group-hover:scale-100">{message}</span>
        </div>
    )
}


export default Tooltip;