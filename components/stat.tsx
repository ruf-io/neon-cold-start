import React, { MouseEventHandler } from "react";

interface Percentage {
    positive?: boolean;
    amount: number;
}

interface Props {
    title: string;
    selected?: boolean;
    stat?: string | number;
    help?: string;
    percentage?: Percentage;
    onHover?: (hover: boolean, id?: string,) => void;
    onClick?: MouseEventHandler<HTMLDivElement>;
    id?: string;
}

const Stat = (props: Props) => {
    const { id, selected, stat, title, onHover, onClick } = props;

    return (
        <div
            onMouseEnter={() => onHover && onHover(true, id)}
            onMouseLeave={() => onHover && onHover(false, id)}
            id={id}
            onClick={onClick}
            className={`
                ${onClick ? "cursor-pointer" : ""}
                ${selected ? "border-gray-700" : "border-gray-900"}
                hover:border-gray-700 border  rounded-md p-4 w-56
            `}
        >
            <p className="text-xs text-gray-400 font-light mb-10">{title}</p>
            <p className="text-5xl mt-10 truncate">{stat}</p>
        </div>
    )
}

export default Stat;