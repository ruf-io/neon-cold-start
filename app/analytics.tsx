"use client";
import { MouseEventHandler, useCallback, useEffect, useMemo, useState } from 'react';
import { Response } from './api/utils';
import Stat from '@/components/stat';
import Chart, { Display } from '@/components/chart';
import { ChartData, ChartDataset, Point, ScriptableContext } from 'chart.js';
import Question from '@/components/question';
import DateFilter, { Filter, filtertoString } from '@/components/dateFilter';
import Error from "@/components/error";

interface Benchmark {
    max: number;
    min: number;
    avg: number;
    datapoints: Array<Point>;
    // For bars:
    // datapoints: Array<[number, number]>;
}

interface State<T> {
    loading: boolean;
    error?: string;
    data?: T;
}

export default function Analytics() {
    const [filter, setFilter] = useState<Filter>(Filter.Day);
    const [display, setDisplay] = useState<undefined | Display>(undefined);
    const [state, setState] = useState<State<Benchmark>>({
        loading: true,
        error: undefined,
        data: undefined
    });
    const { loading, error, data: benchmark } = state;
    const benchmarkDataset = useMemo<ChartDataset<"line">>(() => {
        return {
            data: benchmark ? benchmark.datapoints : [],
            pointRadius: 2,
            borderWidth: 1,
            tension: 0.25,
            borderColor: "rgb(56, 189, 248)",
            label: "Cold start",
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

    const onFilterChange = useCallback((newFilter: Filter) => setFilter(newFilter), []);

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
                const res = await fetch(`/api?query=${filtertoString(filter)}`);

                const { data }: Response<{
                    dataPoints: Array<Point>
                }> = await res.json();
                const { dataPoints } = data;

                const sum = dataPoints.reduce((acc, op) => acc + op.y, 0);
                let min = Number.MAX_SAFE_INTEGER;
                let max = Number.MIN_SAFE_INTEGER;
                dataPoints.forEach(({ x, y }) => {
                    if (min > y) {
                        min = y;
                    }
                    if (max < y) {
                        max = y;
                    }
                })
                const avg = sum / dataPoints.length;
                setState({
                    loading: false,
                    error: undefined,
                    data: {
                        datapoints: (data as any).dataPoints,
                        avg,
                        max,
                        min,
                    },
                });
            } catch (err) {
                console.error(err);
                if (typeof err === "string") {
                    setState({
                        loading: false,
                        error: err,
                        data: undefined
                    });
                } else {
                    setState({
                        loading: false,
                        error: JSON.stringify(err),
                        data: undefined
                    });
                }
            }
        }
        asyncOp();
    }, [filter]);

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

    return (
        <>
            <div className='px-16'>
                {loading &&
                    <svg className="m-auto left-1/2 top-1/2 absolute animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                }
                {error &&
                    <div className="m-auto left-1/2 top-1/2 ">
                        <Error message='This is a big error' />
                    </div>
                }
                <div className={`${(loading || error) ? "invisible" : "visible"}`}>
                    <div className='flex w-full'>
                        <div className='mb-10 flex space-x-4 items-center'>
                            <p className="text-xl text-gray-400 font-extralight">Cold Start Times</p>
                            <Question text='Benchmark' />
                        </div>
                        <div className='ml-auto order-3'>
                            <DateFilter filter={filter} handleChange={onFilterChange} />
                        </div>
                    </div>
                    <div className='h-72'>
                        <Chart
                            avg={benchmark?.avg}
                            max={benchmark?.max}
                            min={benchmark?.min}
                            chartData={chartData}
                            display={display}
                        />
                    </div>
                </div>
            </div>
            <div className="flex justify-between pt-10">
                <Stat selected={display === Display.Average} stat={benchmark ? `${benchmark.avg.toFixed(0)}ms` : "-"} title="Average" id="avgStat" onClick={onClick} />
                <Stat selected={display === Display.Maximum} stat={benchmark ? `${benchmark.max.toFixed(0)}ms` : "-"} title="Maximum" id="maxStat" onClick={onClick} />
                <Stat selected={display === Display.Minimum} stat={benchmark ? `${benchmark.min.toFixed(0)}ms` : "-"} title="Minimum" id="minStat" onClick={onClick} />
            </div>
            <div className="text-center m-auto mt-10 w-fit">
                {/* TODO: Complete benchmark */}
            </div>
        </>
    );
}
