import React, { useEffect, useRef } from "react";
import { Line } from "react-chartjs-2";
import { ChartData, ChartDataset, Point, ScriptableContext } from 'chart.js';
import { Chart as ChartJS, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import 'chartjs-adapter-date-fns';

ChartJS.register(...registerables);
ChartJS.register(annotationPlugin);

interface Props {
    avg?: number;
    max?: number;
    min?: number;
    minimalistic?: boolean;
    chartData: ChartData<"line">;
    display?: Display;
}

export enum Display {
    Average,
    Maximum,
    Minimum,
}

export const statIdToDisplay = (str?: string) => {
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

const Chart = (props: Props) => {
    const { avg, max, min, chartData, display, minimalistic } = props;
    const ref = useRef<ChartJS<"line">>(null);

    useEffect(() => {
        const setStyles = (
            // dataset: ChartDataset<"line", (number | [number, number] | null)[]>,
            dataset: ChartDataset<"line", (number | Point | null)[]>,
            matchingValue: number | undefined,
            pointBorderColor: string,
            pointBackgroundColor: string,
        ) => {
            const radius = (ctx: ScriptableContext<"line">) => {
                var value = ctx.dataset.data[ctx.dataIndex] as Point;
                return (value && value.y === matchingValue) ? 15 : 0;
            };
            const pointHoverRadius = (ctx: ScriptableContext<"line">) => {
                var value = ctx.dataset.data[ctx.dataIndex] as Point;
                return (value && value.y === matchingValue) ? 15 : 10;
            };
            const colorBuilder = (border?: boolean) => {
                return (ctx: ScriptableContext<"line">) => {
                    var value = ctx.dataset.data[ctx.dataIndex] as Point;
                    if (value && (value.y === matchingValue)) {
                        return border ? pointBorderColor : pointBackgroundColor;
                    } else {
                        return "rgb(56, 189, 248)";
                    }
                }
            }
            dataset.pointRadius = radius;
            dataset.pointHoverRadius = pointHoverRadius;
            dataset.pointBorderColor = colorBuilder();
            dataset.pointBackgroundColor = colorBuilder();
        }
        if (ref) {
            const data = ref.current?.data;
            if (data) {
                const [dataset] = data.datasets;
                if (dataset) {
                    if (display === Display.Maximum) {
                        setStyles(
                            dataset,
                            max,
                            "rgb(239, 68, 68)",
                            "rgb(239, 68, 68, 0.5)"
                        );
                    } else if (display === Display.Minimum) {
                        setStyles(
                            dataset,
                            min,
                            "rgb(34, 197, 94)",
                            "rgb(34, 197, 94, 0.5)"
                        );
                    } else {
                        // Default options
                        dataset.pointRadius = 0;
                        dataset.pointBorderColor = "rgb(56, 189, 248)";
                        dataset.pointBackgroundColor = "rgb(56, 189, 248, 0.5)";
                    }
                }
            }
        }

        ref.current?.update();
    }, [display, max, min]);

    return (
        // Casting ref to avoid type issues over `ChartJSOrUndefined`.
        <Line ref={ref as any} data={chartData} options={{
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
                legend: { display: false },
                annotation: {
                    annotations: {
                        average: {
                            type: 'line',
                            yMin: avg,
                            yMax: avg,
                            borderColor: '#f1f5f977',
                            borderWidth: 1.2,
                            display: display === Display.Average,
                            borderDash: [3, 3],
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                intersect: false,
                axis: 'x',
            },
            scales: {
                y: {
                    title: { text: "Duration (ms)", display: !minimalistic },
                    beginAtZero: true,
                    grid: {
                        display: false,
                        color: "#FFFFFF0D"
                    },
                    ticks: {
                        maxTicksLimit: 3,
                        display: !minimalistic
                    },
                },
                x: {
                    title: { text: "Time", display: !minimalistic },
                    type: "timeseries",
                    grid: {
                        display: false,
                        color: "#FFFFFF0D"
                    },
                    ticks: {
                        maxTicksLimit: 5,
                        display: !minimalistic
                    }
                }
            },
        }} />
    )
};

export default Chart;