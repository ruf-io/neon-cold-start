"use client";
import Image from "next/image"
import Analytics from "./analytics";
import Explanation from "@/content/explanation.mdx";

export default function Home() {

    return (
        <main className="flex max-w-screen-lg mx-auto min-h-screen flex-col items-center gap-16 py-16">
            {/* Header */}
            <section className="flex w-full items-center">
                <div>
                    <h1 className="text-5xl font-bold">
                        Neon Cold Start Benchmarks
                    </h1>
                    <div className="mt-4 max-w-[590px] text-base-content/70">
                        <a className="link link-info" href="https://neon.tech">Neon Serverless Postgres</a> databases can autosuspend when idle and <em>cold start</em> automatically upon receiving a connection. How fast are cold starts?
                    </div>
                </div>
                <div className="ml-auto my-auto ">
                    <a href="https://github.com/ruf-io/neon-cold-start" target="_blank" className="group">
                        <svg width="50" height="49" viewBox="0 0 50 49" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="24.7551" cy="25.2449" r="23.7551" className="fill-base-100" />
                            <g clip-path="url(#clip0_45_5588)">
                                <path fill-rule="evenodd" clip-rule="evenodd" d="M24.9255 0C11.1423 0 0 11.2292 0 25.1212C0 36.2258 7.13929 45.6256 17.0434 48.9525C18.2816 49.2026 18.7352 48.412 18.7352 47.7469C18.7352 47.1645 18.6944 45.1683 18.6944 43.0884C11.7607 44.5859 10.3168 40.0937 10.3168 40.0937C9.20255 37.1823 7.55153 36.4341 7.55153 36.4341C5.28214 34.8951 7.71684 34.8951 7.71684 34.8951C10.2342 35.0615 11.5551 37.4738 11.5551 37.4738C13.7832 41.2999 17.3735 40.2188 18.8179 39.5532C19.024 37.9311 19.6847 36.8082 20.3862 36.1845C14.8561 35.6021 9.03776 33.4394 9.03776 23.79C9.03776 21.045 10.0276 18.7992 11.5959 17.0525C11.3485 16.4288 10.4816 13.8496 11.8439 10.3977C11.8439 10.3977 13.9485 9.73211 18.6939 12.9763C20.7256 12.4264 22.8208 12.1467 24.9255 12.1443C27.0301 12.1443 29.1755 12.4358 31.1566 12.9763C35.9026 9.73211 38.0071 10.3977 38.0071 10.3977C39.3694 13.8496 38.502 16.4288 38.2546 17.0525C39.8643 18.7992 40.8133 21.045 40.8133 23.79C40.8133 33.4394 34.9949 35.5602 29.4235 36.1845C30.3316 36.9746 31.1153 38.4716 31.1153 40.8425C31.1153 44.2113 31.0745 46.9149 31.0745 47.7464C31.0745 48.412 31.5286 49.2026 32.7663 48.953C42.6704 45.6251 49.8097 36.2258 49.8097 25.1212C49.8505 11.2292 38.6674 0 24.9255 0Z" className="fill-base-content group-hover:fill-primary"  />
                            </g>
                            <defs>
                                <clipPath id="clip0_45_5588">
                                    <rect width="50" height="49" fill="white" />
                                </clipPath>
                            </defs>
                        </svg>

                    </a>
                </div>
            </section>

            {/* Analytics */}
            <Analytics />

            {/* Content */}
            <section className="w-full prose dark:prose-invert">
                <Explanation  />
            </section>
        </main>
    );
}
