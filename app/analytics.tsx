"use client";
import { MouseEventHandler, useCallback, useEffect, useMemo, useState } from 'react';
import Stat from '@/components/stat';
import Chart, { Display } from '@/components/chart';
import { ChartData, ChartDataset, Point, ScriptableContext } from 'chart.js';
import Question from '@/components/question';
import DateFilter, { Filter, filtertoString } from '@/components/dateFilter';
import Error from "@/components/error";
import Benchmark from './benchmark';

interface Response<T> {
    data: T;
};

interface Benchmark {
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
    const [benchmarkPage, setBenchmarkPage] = useState(false);
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
            pointRadius: 0,
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

    const onBenchmarkClick = useCallback(() => {
        setBenchmarkPage(!benchmarkPage);
    }, [benchmarkPage]);

    useEffect(() => {
        const asyncOp = async () => {
            try {
                setBenchmarkPage(false);
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
                <div className="flex justify-between pt-10">
                    <Stat selected={display === Display.Average} stat={benchmark ? `${benchmark.avg.toFixed(0)}ms` : "-"} title="Average" id="avgStat" onClick={onClick} />
                    <Stat selected={display === Display.Maximum} stat={benchmark ? `${benchmark.max.toFixed(0)}ms` : "-"} title="Maximum" id="maxStat" onClick={onClick} />
                    <Stat selected={display === Display.Minimum} stat={benchmark ? `${benchmark.min.toFixed(0)}ms` : "-"} title="Minimum" id="minStat" onClick={onClick} />
                </div>
            </div>
            <div className="text-center m-auto mt-10 w-fit">
                <button
                    type="button"
                    className="bg-indigo-600 text-white mx-auto inline-flex items-center gap-x-1.5 rounded-md disabled:bg-indigo-900 px-3 py-2 text-sm font-semibold shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    onClick={onBenchmarkClick}
                >
                    <svg className="-ml-0.5 h-5 w-5" aria-hidden="true" width="21" height="24" viewBox="0 0 21 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path className="disabled:fill-slate-500" fillRule="evenodd" clipRule="evenodd" d="M7.21874 0.805369C7.21874 0.360577 7.58599 0 8.03905 0H10.5H12.9609C13.414 0 13.7812 0.360577 13.7812 0.805369C13.7812 1.25016 13.414 1.61074 12.9609 1.61074H11.3203V3.41351C13.1223 3.55021 14.7968 4.13351 16.2291 5.05082C16.2612 5.007 16.2973 4.96513 16.3374 4.92573L17.978 3.315C18.3784 2.92185 19.0276 2.92185 19.4281 3.315C19.8286 3.70814 19.8286 4.34555 19.4281 4.7387L17.8287 6.30897C19.7851 8.18134 21 10.797 21 13.6912C21 19.3846 16.299 24 10.5 24C4.70099 24 0 19.3846 0 13.6912C0 8.2689 4.26408 3.82438 9.67967 3.41351V1.61074H8.03905C7.58599 1.61074 7.21874 1.25016 7.21874 0.805369ZM1.64062 13.6912C1.64062 8.88747 5.60709 4.99326 10.5 4.99326C15.3928 4.99326 19.3594 8.88747 19.3594 13.6912C19.3594 18.495 15.3928 22.3893 10.5 22.3893C5.60709 22.3893 1.64062 18.495 1.64062 13.6912ZM10.5 13.6912V6.60399C6.51317 6.60399 3.28124 9.77705 3.28124 13.6912C3.28124 17.6054 6.51317 20.7785 10.5 20.7785C12.4934 20.7785 14.2981 19.9852 15.6043 18.7026L10.5 13.6912Z" fill="white" />
                    </svg>
                    Benchmark
                </button>
            </div>
            <div className='mt-14'>
                {benchmarkPage && benchmark && <Benchmark duration={benchmark.avg} altDuration={benchmark.max} />}
            </div>
        </>
    );
}
