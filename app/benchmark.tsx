import { formatFloatToStatString } from "@/components/stat";
import React, { useEffect, useState } from "react";

interface Props {
    cold_start_connect_query_response_ms: number;
    altDuration: number;
}

const Benchmark = (props: Props) => {
    const { duration, altDuration } = props;
    const [display, setDisplay] = useState(false);
    const [altDisplay, setAltDisplay] = useState(false);
    const [counter, setCounter] = useState(0);

    useEffect(() => {
        let start = Date.now();
        const intervalId = setInterval(() => {
            const now = Date.now();
            const diff = now - start;
            const durationSurpassed = diff > duration;
            const altDurationSurpassed = diff > altDuration;

            if (durationSurpassed) {
                setDisplay(true);
            }
            if (altDurationSurpassed) {
                setAltDisplay(true);
            }

            if (durationSurpassed && altDurationSurpassed) {
                clearInterval(intervalId);
                setCounter(duration > altDuration ? duration : altDuration);
            } else {
                setCounter(diff);
            }
        }, 53);

        return () => {
            clearInterval(intervalId);
        }
    }, [duration, altDuration]);

    return (
        <>
            <div className="text-center mb-6">
                <p className="text-2xl">Time to load</p>
                <p className="text-sm text-gray-600">Use this as a reference to understand how long it takes for a user to see results from a cold start.</p>
            </div>

            <div className="border p-4 py-8 border-gray-600 border-opacity-50 rounded">
                <div className="grid grid-cols-2">
                    <div>
                        <div className="border border-slate-700 shadow rounded-md p-4 max-w-sm w-full mx-auto">
                            <div className={`${display ? "" : "animate-pulse"} flex space-x-4`}>
                                <div className="rounded-full bg-slate-700 h-10 w-10"></div>
                                <div className="flex-1 space-y-6 py-1">
                                    <div className="h-2 bg-slate-700 rounded"></div>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="h-2 bg-slate-700 rounded col-span-2"></div>
                                            <div className="h-2 bg-slate-700 rounded col-span-1"></div>
                                        </div>
                                        <div className="h-2 bg-slate-700 rounded"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="px-4 pt-2 w-fit text-gray-500 font-light text-sm m-auto flex gap-2">
                            {display && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 inline-block stroke-green-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            } P50 ({formatFloatToStatString(duration)})
                        </p>
                    </div>
                    <div>
                        <div className="border border-slate-700 shadow rounded-md p-4 max-w-sm w-full mx-auto">
                            <div className={`${altDisplay ? "" : "animate-pulse"} flex space-x-4`}>
                                <div className="rounded-full bg-slate-700 h-10 w-10"></div>
                                <div className="flex-1 space-y-6 py-1">
                                    <div className="h-2 bg-slate-700 rounded"></div>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="h-2 bg-slate-700 rounded col-span-2"></div>
                                            <div className="h-2 bg-slate-700 rounded col-span-1"></div>
                                        </div>
                                        <div className="h-2 bg-slate-700 rounded"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="px-4 pt-2 w-fit text-gray-500 font-light text-sm m-auto flex gap-2">
                            {altDisplay && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 inline-block stroke-green-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            } Maximum ({formatFloatToStatString(altDuration)})
                        </p>
                    </div>
                </div>
                <div className="m-auto text-4xl w-fit mt-10">
                    {formatFloatToStatString(counter)}
                </div>
            </div>
        </>
    );
}

export default Benchmark;