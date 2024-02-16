"use client";
import { MouseEventHandler, useCallback, useEffect, useMemo, useState } from 'react';
import { Endpoint, Operation, Project } from '@neondatabase/api-client';
import { Response } from './api/utils';
import Stat from '@/components/stat';
import Chart, { Display } from '@/components/chart';
import { ChartData, ChartDataset, Point, ScriptableContext } from 'chart.js';
import Question from '@/components/question';
import Benchmark from './benchmark';

interface BenchmarkRun {
    id: string,
    ts: string,
    duration: number,
}

// Is this interface correct?
interface BenchmarkStats {
    id: string,
    min: number,
    max: number,
    avg: number,
    ts: Date,
}


interface Analytics {
    max: number;
    min: number;
    avg: number;
    datapoints: Array<Point>;
}

interface State<T> {
    loading: boolean;
    error?: string;
    data?: T;
}

export default function Analytics() {
    const [endpoint, setEndpoint] = useState<Endpoint | undefined>(undefined);
    const [benchmarkId, setBenchmarkId] = useState<string | undefined>(undefined);
    const [benchmark, setBenchmark] = useState<Array<Point> | undefined>(undefined);
    const [lastBenchmark, setLastBenchmark] = useState<BenchmarkStats | undefined>(undefined);
    const [display, setDisplay] = useState<undefined | Display>(undefined);
    const benchmarkDataset = useMemo<ChartDataset<"line">>(() => {
        return {
            data: benchmark || [],
            pointRadius: 2,
            borderWidth: 1,
            tension: 0.25,
            // borderColor: "rgb(255, 134, 69)",
            borderColor: "rgb(56, 189, 248)",
            label: "Compute start + query latency",
            type: "line",
            fill: "start",
        };
    }, [benchmark]);
    const datasets: Array<ChartDataset<"line">> = benchmark ? [benchmarkDataset] : [benchmarkDataset];

    const statIdToDisplay = (str?: string) => {
        switch (str) {
            case "avgStat":
                return Display.Average;
            case "maxStat":
                return Display.Maximum;
            case "minStat":
                return Display.Minimum;

            default:
                break;
        }
    };

    const onClick = useCallback<MouseEventHandler<HTMLDivElement>>((e) => {
        const statDisplay = statIdToDisplay(e.currentTarget.id);
        if (display === statDisplay) {
            setDisplay(undefined);
        } else {
            setDisplay(statDisplay);
        }
        e.preventDefault();
    }, [display]);

    useEffect(() => {
        const asyncOp = async () => {
            try {
                // TODO: Replace with latest benchmark
                const response = await fetch('/api/benchmarks');
                const benchmarksStatsData: Response<{ benchmarks: Array<BenchmarkStats> }> = await response.json();
                const { benchmarks: benchmarksStats } = benchmarksStatsData.data;

                // Benchmarks are sorted by timestamp. The head is the latest.
                let lastBenchmarkStats: BenchmarkStats | undefined = benchmarksStats[0];
                console.log("Benchs: ", lastBenchmarkStats, benchmarksStats);

                const benchmarkRunsResponse = await fetch(`/api/benchmarks/${lastBenchmarkStats.id}`);
                const benchmarkRunData: Response<{ benchmarks: Array<BenchmarkRun> }> = await benchmarkRunsResponse.json();
                const { benchmarks: benchmarkRuns } = benchmarkRunData.data;

                console.log(lastBenchmarkStats);
                setLastBenchmark(lastBenchmarkStats);
                // TODO: Fix any here.
                setBenchmark(benchmarkRuns.map(({ ts, duration }: BenchmarkRun) => ({
                    x: ts,
                    y: duration,
                } as any)));
            } catch (err) {
                console.error(err);
            }
        }
        asyncOp();
    }, [benchmarkId]);

    useEffect(() => {
        const asyncOp = async () => {
            try {
                const res = await fetch("/api",);
                // TODO: Projects are not used.
                const { data }: Response<{
                    operations: Array<Array<Operation>>,
                    projects: Array<Project>,
                    endpoint: Endpoint,
                }> = await res.json();
                setEndpoint(data.endpoint);
            } catch (err) {
                // TODO: 
                console.error("Err");
            }
        };

        asyncOp();
    }, []);

    // datasets[0].data = data?.datapoints || [];
    datasets[0].backgroundColor = (context: ScriptableContext<"line">) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, "rgba(56, 189, 248, 0.4)");
        gradient.addColorStop(1, "rgba(56, 189, 248, 0)");
        return gradient;
    };

    const chartData: ChartData<"line"> = {
        datasets
    };

    // TODO: Fill error.
    // if (error) {
    //     return (
    //         <>
    //             <div>
    //                 <div className='flex mb-10 space-x-4 items-center'>
    //                     {error}
    //                 </div>
    //             </div>
    //         </>
    //     )
    // }

    return (
        <>
            <div className='px-16'>
                <div className='mb-10 flex space-x-4 items-center'>
                    <p className="text-xl text-gray-400 font-extralight">Cold Start Times</p>
                    <Question text='Benchmark' />
                </div>
                {/*
                    Render after analytics are calculated.
                    Otherwise, data is not displayed correctly.
                    The alternative is to update the chart manually using the ref.
                */}
                <div className='h-72'>
                    <Chart
                        avg={lastBenchmark?.avg}
                        max={lastBenchmark?.max}
                        min={lastBenchmark?.min}
                        chartData={chartData}
                        display={display}
                    />
                </div>
            </div>
            <div className="flex justify-between pt-10">
                <Stat selected={display === Display.Average} stat={lastBenchmark ? `${lastBenchmark.avg.toFixed(0)}ms` : "-"} title="Average" id="avgStat" onClick={onClick} />
                <Stat selected={display === Display.Maximum} stat={lastBenchmark ? `${lastBenchmark.max.toFixed(0)}ms` : "-"} title="Maximum" id="maxStat" onClick={onClick} />
                <Stat selected={display === Display.Minimum} stat={lastBenchmark ? `${lastBenchmark.min.toFixed(0)}ms` : "-"} title="Minimum" id="minStat" onClick={onClick} />
            </div>
            <div className="text-center m-auto mt-10">
                <Benchmark endpoint={endpoint} handleBenchmarkId={(id) => setBenchmarkId(id)} />
            </div>
        </>
    );
}
