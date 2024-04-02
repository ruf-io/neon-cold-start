import React, { useRef } from "react";
import { Line } from "react-chartjs-2";
import { ChartData, ChartDataset, Point, ScriptableContext } from 'chart.js';
import { Chart as ChartJS, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import 'chartjs-adapter-date-fns';
import resolveConfig from 'tailwindcss/resolveConfig'
import tailwindConfigRaw from '@/tailwind.config.ts'

const tailwindConfig = resolveConfig(tailwindConfigRaw)
let currentTheme = 'neon_light';
if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    currentTheme = 'neon_dark';
}
export const themeColors = tailwindConfig.daisyui.themes[0][currentTheme];

ChartJS.register(...registerables);
ChartJS.register(annotationPlugin);

interface Props {
    avg?: number;
    max?: number;
    min?: number;
    p99?: number;
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
    const { avg, max, min, p99, chartData, display, minimalistic } = props;
    const ref = useRef<ChartJS<"line">>(null);

    return (
        // Casting ref to avoid type issues over `ChartJSOrUndefined`.
        <Line ref={ref as any} data={chartData} options={{
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
                legend: { display: false },
                annotation: {
                    annotations: ( minimalistic ? {} : {
                        average: {
                            type: 'line',
                            yMin: avg,
                            yMax: avg,
                            borderColor: themeColors['base-content'] + "AA",
                            borderWidth: 1,
                            borderDash: [3, 3],
                            label: {
                                content: `AVG: ${avg ? Math.round(avg) : '-'}ms`,
                                display: true,
                                position: 'start',
                                backgroundColor: "#FFFFFF00",
                                yAdjust: -10,
                                color: themeColors['base-content'],
                                font: {
                                    weight: 'normal',
                                    size: 11
                                }
                            }
                        },
                        p99: {
                            type: 'line',
                            yMin: p99,
                            yMax: p99,
                            borderColor: themeColors.error,
                            borderWidth: 1,
                            borderDash: [3, 3],
                            label: {
                                content: `P99: ${p99 ? Math.round(p99) : '-'}ms`,
                                display: true,
                                position: 'start',
                                backgroundColor: "#FFFFFF00",
                                color: themeColors['base-content'],
                                yAdjust: -10,
                                font: {
                                    weight: 'normal',
                                    size: 11
                                }
                            }
                        }
                    })
                }
            },
            interaction: {
                mode: 'nearest',
                intersect: false,
                axis: 'x',
            },
            scales: {
                y: {
                    title: { text: "Duration (ms)", display: !minimalistic, color: themeColors['base-content'] + "88" },
                    beginAtZero: true,
                    grid: {
                        display: false
                    },
                    border: {
                        color: themeColors['base-content'] + (minimalistic ? "33" : "66")
                    },
                    ticks: {
                        color: themeColors['base-content'] + "88",
                        maxTicksLimit: 3,
                        display: !minimalistic
                    },
                },
                x: {
                    title: { text: "Time", display: !minimalistic, color: themeColors['base-content'] + "88" },
                    type: "timeseries",
                    grid: {
                        display: false
                    },
                    border: {
                        color: themeColors['base-content'] + (minimalistic ? "33" : "66")
                    },
                    ticks: {
                        maxTicksLimit: 5,
                        display: !minimalistic,
                        color: themeColors['base-content'] + "88"
                    }
                }
            },
        }} />
    )
};

export default Chart;