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

export const formatFloatToStatString = (float?: number) => {
    return float ? `${(float / 1000).toPrecision(3)}s` : "-";
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
            <p className="text-sm text-gray-600 font-light mb-5 text-center">{title}</p>
            <p className="text-5xl mt-5 truncate text-center">{stat}</p>
        </div>
    )
}

export default Stat;