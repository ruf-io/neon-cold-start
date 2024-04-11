import { BranchBenchmark } from "@/hooks";
import { ChartDataset } from "chart.js";
import React from "react";
import Chart from "./chart";
import { formatFloatToStatString } from "./stat";

interface Props {
    branchBenchmark: BranchBenchmark;
    datasets: Array<ChartDataset<"line">>;
}

const ChartStat = (props: Props) => {
    const { branchBenchmark, datasets } = props;
    const {
        description,
        name,
        cold_start,
        connect,
        query
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
            <div className='h-20 mt-4'>
                <Chart
                    p50={cold_start.p50}
                    chartData={{ datasets: datasets }}
                    minimalistic={true}
                />
            </div>
            <div className="overflow-x-auto">
  <table className="table table-sm">
    <thead>
      <tr>
        <th></th>
        <th>P50</th>
        <th>P99</th>
        <th>StdDev</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span className="bg-secondary inline-block w-1.5 h-1.5 mr-2 rounded"></span>Cold Start</td>
        <td>{cold_start.p50}ms</td>
        <td>{cold_start.p99}ms</td>
        <td>{cold_start.stdDev}ms</td>
      </tr>
      <tr>
        <td><span className="bg-primary inline-block w-1.5 h-1.5 mr-2 rounded"></span>Connect</td>
        <td>{connect.p50}ms</td>
        <td>{connect.p99}ms</td>
        <td>{connect.stdDev}ms</td>
      </tr>
      <tr>
        <td><span className="bg-accent inline-block w-1.5 h-1.5 mr-2 rounded"></span>Query</td>
        <td>{query.p50}ms</td>
        <td>{query.p99}ms</td>
        <td>{query.stdDev}ms</td>
      </tr>
      <tr>
        <th><span className="inline-block w-1.5 h-1.5 mr-2 rounded"></span>Total</th>
        <th>{cold_start.p50 + connect.p50 + query.p50}ms</th>
        <th>{cold_start.p99 + connect.p99 + query.p99}ms</th>
      </tr>
    </tbody>
  </table>
</div>
        </div>
    );
};

export default ChartStat;