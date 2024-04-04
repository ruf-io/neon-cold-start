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

const doubleZero = (num: number) => num < 10 ? `0${num}` : num;

ChartJS.register(...registerables);
ChartJS.register(annotationPlugin);

interface Props {
    p50?: number;
    p99?: number;
    stdDev?: number;
    minimalistic?: boolean;
    chartData: ChartData<"line">;
}

const Chart = (props: Props) => {
    const { p50, p99, stdDev, chartData, minimalistic } = props;
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
                        p50: {
                            type: 'line',
                            yMin: p50,
                            yMax: p50,
                            borderColor: themeColors['base-content'] + "AA",
                            borderWidth: 1,
                            borderDash: [3, 3],
                            label: {
                                content: `P50: ${p50 ? Math.round(p50) : '-'}ms`,
                                display: true,
                                position: 'start',
                                backgroundColor: "#FFFFFF",
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
                                backgroundColor: "#FFFFFF",
                                color: themeColors['base-content'],
                                font: {
                                    weight: 'normal',
                                    size: 11
                                }
                            }
                        },
                        stddev: {type: 'box',
                        yMin: p50 && stdDev ? p50 - stdDev : 0,
                        yMax: p50 && stdDev ? p50 + stdDev : 0,
                        borderColor: "#00000000",
                        backgroundColor: themeColors['base-content'] + "10"}
                        
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
                        color: themeColors['base-content'] + "88",
                        callback: function(value, index, ticks) {
                            const d = new Date(value);
                            return `${d.getMonth() + 1}/${d.getDate()} ${doubleZero(d.getHours())}:${doubleZero(d.getMinutes())}`;
                        }
                    }
                }
            },
        }} />
    )
};

export default Chart;