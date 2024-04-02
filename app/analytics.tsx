"use client";
import { MouseEventHandler, useCallback, useMemo, useState } from 'react';
import Stat, { formatFloatToStatString } from '@/components/stat';
import Chart, { Display, statIdToDisplay, themeColors } from '@/components/chart';
import { ChartData, ChartDataset, ScriptableContext } from 'chart.js';
import DateFilter, { Filter } from '@/components/dateFilter';
import Error from "@/components/error";
import useBenchmarks from '@/hooks';
import ChartStat from '@/components/chartStat';


export default function Analytics() {
    const [benchmarkPage, setBenchmarkPage] = useState(false);
    const [filter, setFilter] = useState<Filter>(Filter.Day);
    const [display, setDisplay] = useState<undefined | Display>(undefined);
    const { loading, error, data: benchmark } = useBenchmarks(filter);
    
    const branchDatasets = useMemo<Array<ChartDataset<"line">>>(() => {
        if (benchmark) {
            const { branches } = benchmark;
            const datasets: Array<ChartDataset<"line">> = branches.map(({ dataPoints: data, name }) => ({
                data,
                pointRadius: 0,
                borderWidth: 1,
                tension: 0.25,
                borderColor: themeColors.secondary,
                label: "Cold start",
                type: "line",
                fill: "start",
                backgroundColor: (context: ScriptableContext<"line">) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 50);
                    gradient.addColorStop(0, themeColors.secondary + "1a");
                    gradient.addColorStop(1, themeColors.secondary + "00");
                    return gradient;
                }
            }));

            return datasets;
        }
        return [];
    }, [benchmark]);
    const summaryDataset = useMemo<ChartDataset<"line">>(() => {
        return {
            data: benchmark ? benchmark.summary.dataPoints : [],
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.25,
            borderColor: themeColors.primary,
            label: "Cold start",
            type: "line",
            fill: "start",
            backgroundColor: (context: ScriptableContext<"line">) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                gradient.addColorStop(0, themeColors.primary + "50");
                gradient.addColorStop(1, themeColors.primary + "00");
                return gradient;
            }
        };
    }, [benchmark]);
    const { avg, p99, standardDeviation, sampleSize } = useMemo(() => {
        return {
            avg: benchmark?.summary.avg,
            p99: benchmark?.summary.p99,
            standardDeviation: benchmark?.summary.standardDeviation,
            sampleSize: benchmark?.summary.sampleSize,
        }
    }, [benchmark]);
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

    return (
        <section className="w-full flex flex-col gap-16">
            {loading &&
                <div className="flex items-center justify-center h-96">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            }
            {error &&
                <div className="m-auto left-1/2 top-1/2 ">
                    <Error message='Error processing your request.' />
                </div>
            }
            <div className={`${(loading || error) ? "invisible" : "visible"}`}>
                <div className='flex w-full'>
                    <div className='mb-10 flex-col'>
                        <h2 className="font-bold text-3xl">Benchmark Summary</h2>
                        <p className="text-base-content/70">Cold start times summarized across all tests and variants.</p>
                    </div>
                    <div className='ml-auto order-3'>
                        <DateFilter filter={filter} handleChange={onFilterChange} />
                    </div>
                </div>
                <div className="flex gap-8 items-center justify-center">
                    <div className="flex flex-col gap-8">
                        <div className="flex gap-8">
                            <Stat stat={formatFloatToStatString(avg)} title="Average" key="Average" desc="milliseconds" showTimer={true} help="Average across all variations, all runs" />
                            <Stat stat={formatFloatToStatString(p99)} title="P99" key="P99" desc="milliseconds" showTimer={true} help="99th percentile across all variations, all runs" />
                        </div>
                        <div className="flex gap-8">
                            <Stat stat={formatFloatToStatString(standardDeviation)} title="Standard Deviation" key="standardDeviation" desc="milliseconds" />
                            <Stat stat={formatFloatToStatString(sampleSize)} title="Test Runs" key="ColdStarts" desc="total cold starts" />
                        </div>
                    </div>
                    <div className="h-80 flex-1">
                        <Chart
                            avg={avg}
                            p99={p99}
                            chartData={{ datasets: [summaryDataset] }}
                        />
                    </div>
                </div>
            </div>
            <div>
                <h3 className="text-2xl font-bold">Detailed Stats by Database Variant</h3>
                <p className='text-base-content/70'>Cold start times for specific variations of Neon databases.</p>
                <div className='grid grid-cols-2 gap-6 pt-10'>
                    {
                        benchmark && benchmark.branches.map((branchBenchmark, i) => (
                            <ChartStat key={branchBenchmark.name} branchBenchmark={branchBenchmark} display={display} dataset={branchDatasets[i]} />
                        ))
                    }
                </div>
            </div>
        </section>
    );
}
