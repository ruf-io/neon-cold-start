import { BranchBenchmark } from "@/hooks";
import { ChartDataset } from "chart.js";
import React from "react";
import Chart from "./chart";
import { formatFloatToStatString } from "./stat";

interface Props {
    branchBenchmark: BranchBenchmark;
    dataset: ChartDataset<"line">;
}

const ChartStat = (props: Props) => {
    const { branchBenchmark, dataset } = props;
    const {
        description,
        name,
        p50,
        p99,
        stdDev,
        sampleSize
    } = branchBenchmark;

    return (
        <div id={name} key={name} className='p-4 group'>
            <div className="flex justify-between">
              <div className="flex flex-col py-1">
                  <h4 className="text-xl font-bold">{
                      name
                  }</h4>
                  <p className="text-base-content/70">{description}</p>
              </div>
              <button className="btn btn-ghost btn-xs hidden">View SQL</button>
            </div>
            <div className='h-12 mt-4'>
                <Chart
                    p50={p50}
                    chartData={{ datasets: [dataset] }}
                    minimalistic={true}
                />
            </div>
            <div className="overflow-x-auto">
  <table className="table">
    <thead>
      <tr>
        <th>p50</th>
        <th>P99</th>
        <th>Std Dev</th>
        <th>Runs</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>{formatFloatToStatString(p50)}ms</td>
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