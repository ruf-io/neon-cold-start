import { Endpoint } from "@neondatabase/api-client";
import React, { useCallback, useState } from "react";

interface Props {
    endpoint?: Endpoint;
    handleBenchmarkId?: (id: string) => void;
}

const Benchmark = (props: Props) => {
    const { endpoint, handleBenchmarkId } = props;
    const [benchmarkRun, setBenchmarkRun] = useState<number | undefined>(undefined);
    const [benchmarking, setBenchmarking] = useState<boolean>(false);

    const onBenchmarkClick = useCallback(async () => {
        setBenchmarking(true);
        const request = await fetch("/api/benchmarks", {
            method: "POST",
            body: JSON.stringify({
                init: true,
                projectId: endpoint?.project_id,
                endpointId: endpoint?.id,
            })
        });
        const { id } = (await request.json()).data;

        let counter = 0;
        while (counter < 10) {
            setBenchmarkRun(counter);
            try {
                await fetch("/api/benchmarks", {
                    method: "POST",
                    body: JSON.stringify({
                        id,
                        projectId: endpoint?.project_id,
                        endpointId: endpoint?.id,
                    })
                });
            } catch (err) {
                console.error(err);
            } finally {
                counter = counter + 1;
            }
        }

        setBenchmarkRun(undefined);
        setBenchmarking(false);
        if (handleBenchmarkId) {
            handleBenchmarkId(id);
        };
    }, [endpoint]);

    return (
        <>
            <button
                type="button"
                className="mt-10 text-white mx-auto inline-flex items-center gap-x-1.5 rounded-md disabled:bg-indigo-900  bg-indigo-600 px-3 py-2 text-sm font-semibold shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                disabled={benchmarking || !endpoint}
                onClick={onBenchmarkClick}
            >
                <svg className="-ml-0.5 h-5 w-5" aria-hidden="true" width="21" height="24" viewBox="0 0 21 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path className="disabled:fill-slate-500" fillRule="evenodd" clipRule="evenodd" d="M7.21874 0.805369C7.21874 0.360577 7.58599 0 8.03905 0H10.5H12.9609C13.414 0 13.7812 0.360577 13.7812 0.805369C13.7812 1.25016 13.414 1.61074 12.9609 1.61074H11.3203V3.41351C13.1223 3.55021 14.7968 4.13351 16.2291 5.05082C16.2612 5.007 16.2973 4.96513 16.3374 4.92573L17.978 3.315C18.3784 2.92185 19.0276 2.92185 19.4281 3.315C19.8286 3.70814 19.8286 4.34555 19.4281 4.7387L17.8287 6.30897C19.7851 8.18134 21 10.797 21 13.6912C21 19.3846 16.299 24 10.5 24C4.70099 24 0 19.3846 0 13.6912C0 8.2689 4.26408 3.82438 9.67967 3.41351V1.61074H8.03905C7.58599 1.61074 7.21874 1.25016 7.21874 0.805369ZM1.64062 13.6912C1.64062 8.88747 5.60709 4.99326 10.5 4.99326C15.3928 4.99326 19.3594 8.88747 19.3594 13.6912C19.3594 18.495 15.3928 22.3893 10.5 22.3893C5.60709 22.3893 1.64062 18.495 1.64062 13.6912ZM10.5 13.6912V6.60399C6.51317 6.60399 3.28124 9.77705 3.28124 13.6912C3.28124 17.6054 6.51317 20.7785 10.5 20.7785C12.4934 20.7785 14.2981 19.9852 15.6043 18.7026L10.5 13.6912Z" fill="white" />
                </svg>
                Benchmark
            </button>
            {benchmarking &&
                <p className="mt-5">
                    {benchmarkRun ? `Run ${benchmarkRun}/10` : "Initializing benchmark."}
                </p>
            }
        </>
    );
};

export default Benchmark;