"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { useSession } from "@/store/useSession";
import { useEditor } from "@/store/useEditor";

import { AppShell } from "@/components/layout/AppShell";
import { ClassSidebar } from "@/components/sidebar/ClassSidebar";
import { CameraGrid } from "@/components/grid/CameraGrid";
import { ImageEditor } from "@/components/editor/ImageEditor";

import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import type { CamInfo } from "@/types/session";

type SessionOpenResp = {
    cams: CamInfo[];
    maxFrames?: number;
};

export default function AnnotatePage() {
    const search = useSearchParams();
    const initialSession = search.get("session") ?? process.env.NEXT_PUBLIC_SESSION_PATH ?? "";

    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(false);

    const {
        sessionPath,
        cams,
        selectedCamIdx,
        tIndex,
        setSessionPath,
        setCams,
        setSelectedCamIdx,
        setTIndex,
        reset: resetSession,
    } = useSession();

    const { rotation } = useEditor();

    // timeline offsets + max frames
    const [offsets, setOffsets] = useState<number[]>([0]);
    const [maxFrames, setMaxFrames] = useState<number>(0);

    useEffect(() => {
        if (!initialSession) {
            resetSession();
            setReady(false);
            return;
        }
        setLoading(true);
        const controller = new AbortController();
        (async () => {
            const res = await fetch("/api/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionPath: initialSession }),
                signal: controller.signal,
            });
            const data: SessionOpenResp & { error?: string } = await res.json();
            if (!res.ok) {
                resetSession();
                setReady(false);
                toast.error(data?.error ?? "Failed to open session");
                setLoading(false);
                return;
            }
            setSessionPath(initialSession);
            setCams(Array.isArray(data.cams) ? data.cams : []);
            setTIndex(0);
            setSelectedCamIdx(null);
            setMaxFrames(Math.max(0, data.maxFrames ?? 0));
            setReady(true);
            setLoading(false);
            toast.success("Session loaded.");
        })();
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialSession]);

    const currentCam: CamInfo | null = useMemo(() => {
        if (selectedCamIdx == null) return null;
        return cams.find((c) => c.idx === selectedCamIdx) ?? null;
    }, [cams, selectedCamIdx]);

    return (
        <AppShell
            sidebar={<ClassSidebar />}
            headerRight={<div className="text-sm text-muted-foreground">
                {sessionPath ? `Session: ${sessionPath}` : "No session"}
            </div>}
            footer={
                <div className="w-full px-4 py-3">
                    <div className="mb-2 text-base font-semibold">Timeline</div>
                    <div className="mb-3 flex items-center gap-4">
                        <div className="min-w-[160px] text-xs text-muted-foreground">Add time offset</div>
                        <div className="flex-1">
                            <Slider
                                min={0}
                                max={Math.max(0, maxFrames - 1)}
                                step={1}
                                value={[offsets[offsets.length - 1] ?? 0]}
                                onValueChange={(v) => {
                                    const val = Math.max(0, Math.floor(v[0] ?? 0));
                                    const next = Array.from(new Set([...offsets, val])).sort((a, b) => a - b);
                                    setOffsets(next);
                                }}
                            />
                        </div>
                        <div className="text-xs text-muted-foreground">{offsets.join(", ")}</div>
                    </div>

                    <div className="overflow-x-hidden">
                        <CameraGrid
                            sessionPath={sessionPath}
                            cams={cams}
                            offsets={offsets}
                            activeCamIdx={selectedCamIdx ?? undefined}
                            activeT={tIndex}
                            onOpen={(camIdx, t) => {
                                setSelectedCamIdx(camIdx);
                                setTIndex(t);
                            }}
                        />
                    </div>
                </div>
            }
        >
            <div className="h-full w-full overflow-hidden">
                {!ready ? (
                    <div className="h-full flex items-center justify-center">
                        <Card className="p-6">
                            {loading ? "Loading session…" : "Provide ?session=/abs/path or NEXT_PUBLIC_SESSION_PATH"}
                        </Card>
                    </div>
                ) : (
                    <div className="h-full">
                        {currentCam ? (
                            <ImageEditor
                                key={`${sessionPath}-${currentCam.idx}-${tIndex}-${rotation}`}
                                sessionPath={sessionPath}
                                cam={currentCam}
                                t={tIndex}
                            />
                        ) : (
                            <div className="h-[360px] flex items-center justify-center border rounded-md text-sm text-muted-foreground">
                                Select a camera tile from the timeline below.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppShell>
    );
}