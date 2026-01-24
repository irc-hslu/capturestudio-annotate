import * as React from "react";

export default function AnnotateLoading() {
    return (
        <div className="flex h-[calc(100vh-56px)] w-full flex-col gap-3">
            {/* Top controls skeleton */}
            <div className="animate-pulse rounded-md border bg-white p-3">
                <div className="flex items-center gap-2">
                    <div className="h-9 flex-1 rounded-md bg-neutral-200" />
                    <div className="h-9 w-32 rounded-md bg-neutral-200" />
                </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-3">
                {/* Left sidebar skeleton */}
                <div className="animate-pulse rounded-md border bg-white p-3">
                    <div className="mb-3 h-4 w-24 rounded bg-neutral-200" />
                    <div className="space-y-2">
                        <div className="h-8 rounded bg-neutral-200" />
                        <div className="h-8 rounded bg-neutral-200" />
                        <div className="h-8 rounded bg-neutral-200" />
                    </div>
                </div>

                {/* Editor + grid skeleton */}
                <div className="flex min-h-0 flex-col rounded-md border bg-white">
                    <div className="animate-pulse min-h-0 flex-1 p-3">
                        <div className="h-full w-full rounded bg-neutral-200" />
                    </div>
                    <div className="border-t p-3">
                        <div className="mb-2 h-6 w-40 animate-pulse rounded bg-neutral-200" />
                        <div className="grid grid-cols-6 gap-2">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="h-24 animate-pulse rounded bg-neutral-200" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}