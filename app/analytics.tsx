"use client";
import { MouseEventHandler, useCallback, useEffect, useMemo, useState } from 'react';
import { Response } from './api/utils';
import Stat from '@/components/stat';
import Chart, { Display } from '@/components/chart';
import { ChartData, ChartDataset, Point, ScriptableContext } from 'chart.js';
import Question from '@/components/question';
import DateFilter, { Filter, filtertoString } from '@/components/dateFilter';

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
    const [benchmark, setBenchmark] = useState<Benchmark | undefined>(undefined);
    const [display, setDisplay] = useState<undefined | Display>(undefined);
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
                setBenchmark({
                    datapoints: (data as any).dataPoints,
                    avg,
                    max,
                    min,
                });
            } catch (err) {
                console.error(err);
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
                <div className='flex w-full'>
                    <div className='mb-10 flex space-x-4 items-center'>
                        <p className="text-xl text-gray-400 font-extralight">Cold Start Times</p>
                        <Question text='Benchmark' />
                    </div>
                    <div className='ml-auto order-3'>
                        <DateFilter filter={filter} handleChange={onFilterChange} />
                    </div>
                </div>
                {/*
                    Render after analytics are calculated.
                    Otherwise, data is not displayed correctly.
                    The alternative is to update the chart manually using the ref.
                */}
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
