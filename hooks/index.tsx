import { Filter, filtertoString } from '@/components/dateFilter';
import { Point } from 'chart.js';
import { useState, useEffect } from 'react';
import {quantile, standardDeviation} from 'simple-statistics';

interface Response<T> {
    data: T;
};

interface BranchDescription {
    id: string,
    name: string,
    description: string,
}

export interface BranchPoint extends Point {
    id: string;
}

export interface BranchBenchmark {
    max: number;
    min: number;
    sum: number;
    avg: number;
    stdDev: number;
    p99: number;
    sampleSize: number;
    dataPoints: Array<Point>;
    description: string;
    name: string;
}

export interface Benchmark {
    branches: Array<BranchBenchmark>,
    summary: BranchBenchmark,
}

export interface State<T> {
    loading: boolean;
    error?: string;
    data?: T;
}

const processBranchDatapoint = (branch: BranchBenchmark, dataPoint: BranchPoint | Point) => {
    branch.dataPoints.push(dataPoint);
    branch.sum += dataPoint.y;
    if (branch.min > dataPoint.y) branch.min = dataPoint.y;
    if (branch.max < dataPoint.y) branch.max = dataPoint.y;
}

const initBenchmark = (
    id: string,
    name?: string,
    description?: string,
    branchDescriptions?: Array<BranchDescription>
): BranchBenchmark => {
    if (branchDescriptions) {
        const branchDescription = branchDescriptions.find(x => x.id === id);
        if (branchDescription) {
            return {
                min: Number.MAX_SAFE_INTEGER,
                max: Number.MIN_SAFE_INTEGER,
                sum: 0,
                avg: 0,
                p99: 0,
                stdDev: 0,
                sampleSize: 0,
                dataPoints: [],
                description: branchDescription.description,
                name: branchDescription.name
            };
        }
    }

    return {
        min: Number.MAX_SAFE_INTEGER,
        max: Number.MIN_SAFE_INTEGER,
        sum: 0,
        avg: 0,
        p99: 0,
        stdDev: 0,
        sampleSize: 0,
        dataPoints: [],
        description: description || "",
        name: name || ""
    };
}

// Define the custom hook
const useBenchmarks = (filter: Filter) => {
    // Define state management inside the hook
    const [state, setState] = useState<State<Benchmark>>({
        loading: true,
        error: undefined,
        data: undefined,
    });

    useEffect(() => {
        const asyncOp = async () => {
            try {
                const res = await fetch(`/api?query=${filtertoString(filter)}`);
                const { data }: Response<{
                    dataPoints: Array<BranchPoint>,
                    summary: Array<Point>,
                    branches: Array<BranchDescription>
                }> = await res.json();
                const { dataPoints, summary: summaryDataPoints, branches: branchDescriptions } = data;

                // Calculate sum, min, max.
                const branchesRecord: Record<string, BranchBenchmark> = {};
                const summaryBenchmark: BranchBenchmark = initBenchmark("", "Summary", "Contains a summary for all the branches.");
                summaryDataPoints.forEach((dataPoint) => {
                    processBranchDatapoint(summaryBenchmark, dataPoint);
                });
                dataPoints.forEach(dataPoint => {
                    const { id } = dataPoint;
                    const branch = branchesRecord[id] || initBenchmark(id, undefined, undefined, branchDescriptions);
                    processBranchDatapoint(branch, dataPoint);

                    // Re-assign in case of creation.
                    branchesRecord[id] = branch;
                });

                const branches: Array<BranchBenchmark> = Object.keys(branchesRecord).map(x => ({
                    ...branchesRecord[x],
                    avg: branchesRecord[x].sum / branchesRecord[x].dataPoints.length,
                    stdDev: standardDeviation(branchesRecord[x].dataPoints.map(x => x.y)),
                    p99: quantile(branchesRecord[x].dataPoints.map(x => x.y), 0.99),
                    sampleSize: branchesRecord[x].dataPoints.length,
                }));
                summaryBenchmark.avg = summaryBenchmark.sum / summaryBenchmark.dataPoints.length;
                summaryBenchmark.stdDev = standardDeviation(summaryBenchmark.dataPoints.map(x => x.y));
                summaryBenchmark.p99 = quantile(summaryBenchmark.dataPoints.map(x => x.y), 0.99);
                summaryBenchmark.sampleSize = summaryBenchmark.dataPoints.length;

                // Set the state with the fetched and processed data
                setState({
                    loading: false,
                    error: undefined,
                    data: {
                        branches,
                        summary: summaryBenchmark
                    },
                });
            } catch (err) {
                console.error(err);
                // Handle error
                setState({
                    loading: false,
                    error: typeof err === "string" ? err : JSON.stringify(err),
                    data: undefined
                });
            }
        };

        asyncOp();
    }, [filter]);

    return state;
}

export default useBenchmarks;
