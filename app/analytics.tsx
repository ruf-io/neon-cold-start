"use client";
import { MouseEventHandler, useCallback, useMemo, useState } from "react";
import Stat, { formatFloatToStatString } from "@/components/stat";
import Chart, { themeColors } from "@/components/chart";
import { ChartData, ChartDataset, ScriptableContext } from "chart.js";
import Error from "@/components/error";
import useBenchmarks, { BranchBenchmark } from "@/hooks";
import ChartStat from "@/components/chartStat";

export default function Analytics() {
  const { loading, error, data: benchmark } = useBenchmarks();

  const branchDatasets = useMemo<Array<Array<ChartDataset<"line">>>>(() => {
    if (benchmark) {
      const { branches } = benchmark;
      const datasets: Array<Array<ChartDataset<"line">>> = branches.map(
        (branch: BranchBenchmark) => {
          return [
            {
              data: branch.query.points,
              pointRadius: 0,
              borderWidth: 1,
              tension: 0.25,
              borderColor: themeColors.accent,
              label: "Query",
              type: "line",
              fill: "start",
              backgroundColor: (context: ScriptableContext<"line">) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 60);
                gradient.addColorStop(0, themeColors.accent + "2a");
                gradient.addColorStop(1, themeColors.accent + "00");
                return gradient;
              },
            },
            {
              data: branch.connect.points,
              pointRadius: 0,
              borderWidth: 1,
              tension: 0.25,
              borderColor: themeColors.primary,
              label: "Connect",
              type: "line",
              fill: "start",
              backgroundColor: (context: ScriptableContext<"line">) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 60);
                gradient.addColorStop(0, themeColors.primary + "2a");
                gradient.addColorStop(1, themeColors.primary + "00");
                return gradient;
              },
            },
            {
              data: branch.cold_start.points,
              pointRadius: 0,
              borderWidth: 1,
              tension: 0.25,
              borderColor: themeColors.secondary,
              label: "Cold start",
              type: "line",
              fill: "start",
              backgroundColor: (context: ScriptableContext<"line">) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 60);
                gradient.addColorStop(0, themeColors.secondary + "2a");
                gradient.addColorStop(1, themeColors.secondary + "00");
                return gradient;
              },
            },
          ];
        }
      );

      return datasets;
    }
    return [];
  }, [benchmark]);

  const summaryDataset = useMemo<Array<ChartDataset<"line">>>(() => {
    if (benchmark) {
      return [
        {
          data: benchmark ? benchmark.summary.query.points : [],
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.25,
          borderColor: themeColors.accent,
          label: "Query",
          type: "line",
          fill: "start",
          backgroundColor: themeColors.accent + "AA",
        },
        {
          data: benchmark ? benchmark.summary.connect.points : [],
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.25,
          borderColor: themeColors.primary,
          label: "Connect",
          type: "line",
          fill: "start",
          backgroundColor: (context: ScriptableContext<"line">) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 280);
            gradient.addColorStop(0, themeColors.primary + "FF");
            gradient.addColorStop(1, themeColors.primary + "00");
            return gradient;
          },
        },
        {
          data: benchmark ? benchmark.summary.cold_start.points : [],
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.25,
          borderColor: themeColors.secondary,
          label: "Cold start",
          type: "line",
          fill: "start",
          backgroundColor: (context: ScriptableContext<"line">) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 240);
            gradient.addColorStop(0, themeColors.secondary + "FF");
            gradient.addColorStop(1, themeColors.secondary + "00");
            return gradient;
          },
        },
      ];
    }
    return [];
  }, [benchmark]);

  const { cold_start, connect, query } = useMemo(() => {
    return {
      cold_start: benchmark?.summary.cold_start || {
        p50: 0,
        p99: 0,
        stdDev: 0,
        points: [],
      },
      connect: benchmark?.summary.connect || {
        p50: 0,
        p99: 0,
        stdDev: 0,
        points: [],
      },
      query: benchmark?.summary.query || {
        p50: 0,
        p99: 0,
        stdDev: 0,
        points: [],
      },
    };
  }, [benchmark]);

  return (
    <section className="w-full flex flex-col gap-16">
      {loading && (
        <div className="flex items-center justify-center h-96">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}
      {error && (
        <div className="m-auto left-1/2 top-1/2 ">
          <Error message="Error processing your request." />
        </div>
      )}
      <div className={`${loading || error ? "invisible" : "visible"}`}>
        <div className="flex flex-col lg:flex-row gap-16 items-start justify-center">
          <table className="table table-lg w-auto">
            <tbody>
              <tr>
                <td></td>
                <td className="text-base-content/80">P50</td>
                <td className="text-base-content/60">P99</td>
              </tr>
              <tr className="">
                <td className="whitespace-nowrap flex items-center gap-2 justify-start">
                  <span className="bg-secondary w-2 h-2 inline-block rounded"></span>
                  Cold Start
                </td>
                <td className="font-semibold">{cold_start.p50}ms</td>
                <td className="text-base-content/60">{cold_start.p99}ms</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap flex items-center gap-2 justify-start">
                  <span className="bg-primary w-2 h-2 inline-block rounded"></span>
                  Connect
                </td>
                <td className="font-semibold">{connect.p50}ms</td>
                <td className="text-base-content/60">{connect.p99}ms</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap flex items-center gap-2 justify-start">
                  <span className="bg-accent w-2 h-2 inline-block rounded"></span>
                  Query
                </td>
                <td className="font-semibold">{query.p50}ms</td>
                <td className="text-base-content/60">{query.p99}ms</td>
              </tr>
              <tr className="bg-base-200/20 dark:bg-neutral/60">
                <th className="whitespace-nowrap flex items-center gap-2 justify-start">
                  <span className="w-2 h-2 inline-block rounded"></span>
                  Total
                </th>
                <th>{cold_start.p50 + connect.p50 + query.p50}ms</th>
                <th className="text-base-content/60">
                  {cold_start.p99 + connect.p99 + query.p99}ms
                </th>
              </tr>
            </tbody>
          </table>
          <div className="h-80 flex-1 w-full lg:w-auto">
            <Chart
              title="big"
              p50={cold_start.p50}
              p99={cold_start.p99}
              stdDev={cold_start.stdDev}
              chartData={{ datasets: summaryDataset }}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold">
          How to Read the Benchmarks
        </h3>
      <div className="grid grid-cols-2 xl:grid-cols-3">
        <div className="card">
          <div className="card-body">
            <h3 className="card-title">Cold Starts</h3>
            <p className="text-base-content/70">
              Neon databases can autosuspend when idle and cold start upon
              receiving a new connection. In this benchmark, a cold start adds{" "}
              <code className="text-neutral-content bg-neutral p-1 rounded">~{cold_start.p50}ms</code> latency, resulting in the entire
              query taking{" "}
              <code className="text-neutral-content bg-neutral p-1 rounded">~{cold_start.p50 + connect.p50 + query.p50}ms</code>.
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h3 className="card-title">Connections</h3>
            <p className="text-base-content/70">
              Connecting to Postgres requires a TCP handshake and SSL
              negotiation. Connecting takes <code className="text-neutral-content bg-neutral p-1 rounded">~{connect.p50}ms</code> in
              this benchmark, so connecting and querying on a warm instance
              takes <code className="text-neutral-content bg-neutral p-1 rounded">~{connect.p50 + query.p50}ms</code>.
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h3 className="card-title">Queries</h3>
            <p className="text-base-content/70">
              When a database is active and a connection is established, a
              SELECT query fetching a row by primary key takes{" "}
              <code className="text-neutral-content bg-neutral p-1 rounded">~{query.p50}ms</code> in this benchmark.
            </p>
          </div>
        </div>
      </div>
      </div>

      <div>
        <h3 className="text-3xl font-bold">
          Detailed Stats by Database Variant
        </h3>
        <p className="text-base-content/70">
          Query latencies for specific variations of Neon databases.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-10">
          {benchmark &&
            benchmark.branches.map((branchBenchmark, i) => (
              <ChartStat
                key={branchBenchmark.name}
                branchBenchmark={branchBenchmark}
                datasets={branchDatasets[i]}
              />
            ))}
        </div>
      </div>
    </section>
  );
}
