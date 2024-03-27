import { BranchBenchmark } from "@/hooks";
import { ChartDataset } from "chart.js";
import React from "react";
import Chart, { Display } from "./chart";
import { formatFloatToStatString } from "./stat";
import Question from "./question";
import Health from "./health";

interface Props {
    branchBenchmark: BranchBenchmark;
    display?: Display;
    dataset: ChartDataset<"line">;
}

const ChartStat = (props: Props) => {
    const { branchBenchmark, display, dataset } = props;
    const {
        description,
        name,
        max,
        min,
        avg
    } = branchBenchmark;

    return (
        <div key={name} className='overflow-hidden border rounded-md hover:border-opacity-100 text-center text-gray-600 border-opacity-0 p-4 border-gray-700'>
            <div className="flex space-x-1 items-center py-1">
                {/* Format to uppercase. */}
                <p>{
                    name.replace(/_/g, ' ')
                    .toLowerCase()
                    .replace(/(^\w|\s\w)/g, s => s.toUpperCase())
                }</p>
                <Question className="w-3 h-3 ml-2 whitespace-pre-line" text={<p><b>Benchmark Description</b><br />{description}</p>} />
            </div>
            <div className='h-12 mt-4'>
                <Chart
                    avg={avg}
                    max={max}
                    min={min}
                    chartData={{ datasets: [dataset] }}
                    display={display}
                    minimalistic={true}
                />
            </div>
            {/* <div className="px-1">
                <Health health={1} />
            </div> */}
            <div className='grid grid-cols-3'>
                <div className='text-sm text-gray-400'><p className='text-xs pt-2 text-gray-600'>AVG</p>{formatFloatToStatString(avg)}</div>
                <div className='text-sm text-gray-400'><p className='text-xs pt-2 text-gray-600'>MAX</p>{formatFloatToStatString(max)}</div>
                <div className='text-sm text-gray-400'><p className='text-xs pt-2 text-gray-600'>MIN</p>{formatFloatToStatString(min)}</div>
            </div>
        </div>
    );
};

export default ChartStat;