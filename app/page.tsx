"use client";
import Image from "next/image"
import Analytics from "./analytics";
import Zero from "@/content/zero.mdx";
import Apps from "@/content/apps.mdx";
import Env from "@/content/env.mdx";
import Picutre from "@/content/picture.mdx";

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center p-24 py-16">
            {/* Header */}
            <div className="flex w-full items-center">
                <div>
                    <h1 className="text-5xl font-normal">
                        Neon Cold Start Benchmarks
                    </h1>
                    <div className="text-gray-600 mt-4 w-2/3">
                        An open-source tool to benchmark cold starts.
                    </div>
                </div>
                <div className="ml-auto my-auto ">
                    <a href="https://github.com" target="_blank">
                        <Image src={"github.svg"} alt={"Github logo"} width={45} height={45} />
                    </a>
                </div>
            </div>

            {/* Analytics */}
            <div className="mt-12 w-4/5 items-center">
                <Analytics />
            </div>

            {/* Content */}
            <div className="w-2/3 mt-16">
                <div className=" bg-gray-50 rounded-sm bg-opacity-5 p-10 h-52 font-semibold">
                    <div className="text-4xl text-white">
                        Storage size makes no difference.
                    </div>
                </div>
                <h1 className="text-4xl text-center font-semibold my-20">Scale to zero</h1>
                <div className="flex flex-col space-y-20">
                    <div>
                        <Env />
                    </div>
                    <div>
                        <Zero />
                    </div>
                    <div>
                        <Apps />
                    </div>
                    <div>
                        <Picutre />
                    </div>
                </div>
            </div>
        </main>
    );
}
