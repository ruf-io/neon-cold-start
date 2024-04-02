import { BranchBenchmark } from "@/hooks";
import { ChartDataset } from "chart.js";
import React from "react";
import Chart, { Display } from "./chart";
import { formatFloatToStatString } from "./stat";

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
        avg,
        p99,
        stdDev,
        sampleSize
    } = branchBenchmark;

    return (
        <div key={name} className='p-4'>
            <div className="flex flex-col py-1">
                <h4 className="text-xl font-bold">{
                    name
                }</h4>
                <p className="text-base-content/70">{description}</p>
            </div>
            <div className='h-12 mt-4'>
                <Chart
                    avg={avg}
                    chartData={{ datasets: [dataset] }}
                    display={display}
                    minimalistic={true}
                />
            </div>
            <div className="overflow-x-auto">
  <table className="table">
    <thead>
      <tr>
        <th>Avg</th>
        <th>P99</th>
        <th>Std Dev</th>
        <th>Runs</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>{formatFloatToStatString(avg)}ms</td>
        <td>{formatFloatToStatString(p99)}ms</td>
        <td>{formatFloatToStatString(stdDev)}ms</td>
        <td>{formatFloatToStatString(sampleSize)}</td>
      </tr>
    </tbody>
  </table>
</div>
        </div>
    );
};

export default ChartStat;