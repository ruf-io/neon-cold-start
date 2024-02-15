"use client";
import { MouseEventHandler, useCallback, useEffect, useMemo, useState } from 'react';
import { Endpoint, Operation, OperationAction, Project } from '@neondatabase/api-client';
import { Response } from './api/utils';
import Stat from '@/components/stat';
import Chart, { Display } from '@/components/chart';
import { ChartData, ChartDataset, Point, ScriptableContext } from 'chart.js';
import Question from '@/components/question';
import Benchmark from './benchmark';

// interface BenchmarkRun {
//     ts: Date;
//     duration: number;
// }

// interface Benchmark {
//     max: number;
//     min: number;
//     avg: number;
//     runDate: Date;
// }

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
    // TODO: Implement loading + error.
    const [{
        loading,
        error,
        data
    }, setState] = useState<State<Analytics>>({
        loading: true,
        error: undefined,
        data: undefined
    });
    // const [benchmarks, setBenchmarks] = useState<Array<Benchmark>>(undefined);
    const [benchmarkId, setBenchmarkId] = useState<string | undefined>(undefined);
    const [endpoint, setEndpoint] = useState<Endpoint | undefined>(undefined);
    const [benchmarks, setBenchmarks] = useState<Array<Point> | undefined>(undefined);
    const [display, setDisplay] = useState<undefined | Display>(undefined);
    const lineDataset = useMemo<ChartDataset<"line">>(() => {
        return {
            data: [],
            pointRadius: 2,
            borderWidth: 1,
            tension: 0.25,
            borderColor: "rgb(56, 189, 248)",
            label: "Compute start",
            type: "line",
            fill: "start",
        };
    }, []);
    const benchmarkDataset = useMemo<ChartDataset<"line">>(() => {
        return {
            data: benchmarks || [],
            pointRadius: 2,
            borderWidth: 1,
            tension: 0.25,
            borderColor: "rgb(255, 134, 69)",
            label: "Compute start + query latency",
            type: "line",
            fill: "start",
        };
    }, [benchmarks]);
    const datasets: Array<ChartDataset<"line">> = benchmarks ? [lineDataset, benchmarkDataset] : [lineDataset];

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
                const res = await fetch(`/api/benchmarks/b265954e-babd-4458-a47e-c717cb3a9bf8`);
                const { data } = await res.json();
                // setBenchmarks(data.benchmarks.map((x: Benchmark) => ({
                //     x: x.ts,
                //     y: x.duration,
                // })));
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

                // TODO: Projects is not used.
                const { data }: Response<{
                    operations: Array<Array<Operation>>,
                    projects: Array<Project>,
                    endpoint: Endpoint,
                }> = await res.json();
                // TODO: Multi-project.
                const ops = data.operations[0].filter(x => x.action === OperationAction.StartCompute);
                const sum = ops.reduce((acc, op) => acc + op.total_duration_ms, 0);
                let min = Number.MAX_SAFE_INTEGER;
                let max = Number.MIN_SAFE_INTEGER;
                ops.forEach(({ total_duration_ms }) => {
                    if (min > total_duration_ms) {
                        min = total_duration_ms;
                    }
                    if (max < total_duration_ms) {
                        max = total_duration_ms;
                    }
                })
                const avg = sum / ops.length;
                const chartDataPoints: Array<Point> = ops.map(x => ({
                    x: new Date(x.created_at).getTime(),
                    y: x.total_duration_ms
                }));

                setEndpoint(data.endpoint);
                setState({
                    loading: false,
                    error: undefined,
                    data: {
                        avg,
                        min,
                        max,
                        datapoints: chartDataPoints
                    }
                });
            } catch (err) {
                if (typeof err === "string") {
                    setState({
                        loading: false,
                        error: err,
                        data: undefined,
                    });
                } else {
                    setState({
                        loading: false,
                        error: JSON.stringify(error),
                        data: undefined,
                    });
                }
            }
        };

        asyncOp();
    }, []);

    datasets[0].data = data?.datapoints || [];
    datasets[0].backgroundColor = (context: ScriptableContext<"line">) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, ((data ? data.max : 500) / 3.5));
        gradient.addColorStop(0, "rgba(56, 189, 248, 0.4)");
        gradient.addColorStop(1, "rgba(56, 189, 248, 0)");
        return gradient;
    };

    const chartData: ChartData<"line"> = {
        datasets
    };

    if (error) {
        return (
            <>
                <div>
                    <div className='flex mb-10 space-x-4 items-center'>
                        {error}
                    </div>
                </div>
            </>
        )
    }

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
                        avg={data?.avg}
                        max={data?.max}
                        min={data?.min}
                        chartData={chartData}
                        display={display}
                    />
                </div>
            </div>
            <div className="flex justify-between pt-10">
                <Stat selected={display === Display.Average} stat={data ? `${data.avg.toFixed(0)}ms` : "-"} title="Average" id="avgStat" onClick={onClick} />
                <Stat selected={display === Display.Maximum} stat={data ? `${data.max.toFixed(0)}ms` : "-"} title="Maximum" id="maxStat" onClick={onClick} />
                <Stat selected={display === Display.Minimum} stat={data ? `${data.min.toFixed(0)}ms` : "-"} title="Minimum" id="minStat" onClick={onClick} />
            </div>
            <div className="text-center">
                {endpoint && <Benchmark endpoint={endpoint} handleBenchmarkId={(id) => setBenchmarkId(id)} />}
            </div>
        </>
    );
}
