import React from "react";

interface Props {
    /// Progress is a number from 1 to 100.
    progress: number;
}

const FancyProgressBar = (props: Props) => {
    const { progress } = props;
    return (
        <div className="group relative grid overflow-hidden rounded-full px-4 py-1 shadow-[0_1000px_0_0_hsl(0_0%_20%)_inset] transition-colors duration-200">
            <span>
                <span className="spark mask-gradient animate-flip before:animate-rotate absolute inset-0 h-[100%] w-[100%] overflow-hidden rounded-full [mask:linear-gradient(white,_transparent_50%)] before:absolute before:aspect-square before:w-[200%] before:rotate-[-90deg] before:bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] before:content-[''] before:[inset:0_auto_auto_50%] before:[translate:-50%_-15%]" />
            </span>
            <span className="backdrop absolute inset-[1px] rounded-full bg-black transition-colors duration-200 group-hover:bg-slate-800" />
            <span style={{ width: `${progress}%` }} className={`backdrop absolute inset-[1px] rounded-full bg-white transition-colors duration-200 group-hover:bg-slate-800`} />
        </div>
    );
};

export default FancyProgressBar;