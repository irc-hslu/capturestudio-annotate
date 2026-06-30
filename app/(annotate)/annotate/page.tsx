"use client";

import {useEffect, useMemo, useState} from "react";
import {useSearchParams} from "next/navigation";
import {toast} from "sonner";

import {useSession} from "@/store/useSession";
import {useEditor} from "@/store/useEditor";

import {AppShell} from "@/components/layout/AppShell";
import {ClassSidebar} from "@/components/sidebar/ClassSidebar";
import {CameraGrid} from "@/components/grid/CameraGrid";
import {ImageEditor} from "@/components/editor/ImageEditor";

import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import type {CamInfo} from "@/types/session";
import {TimestampStrip} from "@/components/timeline/TimestampStrip";
import {Slider} from "@/components/ui/slider";

type SessionOpenResp = {
    cams: CamInfo[];
    maxFrames?: number;
};

function clampInt(n: number, lo: number, hi: number) {
    return Math.min(Math.max(lo, Math.floor(n)), hi);
}

export default function AnnotatePage() {
    const search = useSearchParams();
    const initialSession = search.get("session") ?? process.env.NEXT_PUBLIC_SESSION_PATH ?? "";

    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(false);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [pendingOffset, setPendingOffset] = useState(0);

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

    const {rotation} = useEditor();

    // timeline time steps + max frames
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
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({sessionPath: initialSession}),
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

            const camNumFrames = (Array.isArray(data.cams) ? data.cams : [])
                .map((c: any) => Number(c?.numFrames ?? 0))
                .filter((n: number) => n > 0);
            const inferredMaxFrames = camNumFrames.length ? Math.min(...camNumFrames) : 0;
            setMaxFrames(Math.max(0, Number(data.maxFrames ?? inferredMaxFrames ?? 0)));

            // reset time steps to [0] on session load
            setOffsets([0]);

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
            sidebar={<ClassSidebar/>}
            headerRight={
                <div className="text-sm text-muted-foreground">
                    {sessionPath ? `Session: ${sessionPath}` : "No session"}
                </div>
            }
            footer={
                <div className="w-full px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-base font-semibold">Timeline</div>

                        <Button
                            variant="outline"
                            onClick={() => {
                                setPendingOffset(Math.min(Math.max(0, offsets[offsets.length - 1] ?? 0), Math.max(0, maxFrames - 1)));
                                setAddDialogOpen(true);
                            }}
                            disabled={maxFrames <= 0}
                        >
                            Add time step
                        </Button>
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

                    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Select time step</DialogTitle>
                            </DialogHeader>

                            <div className="py-4">
                                <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
                                    <span>0</span>
                                    <span className="font-medium text-foreground">t={pendingOffset}</span>
                                    <span>{Math.max(0, maxFrames - 1)}</span>
                                </div>

                                <Slider
                                    min={0}
                                    max={Math.max(0, maxFrames - 1)}
                                    step={1}
                                    value={[pendingOffset]}
                                    onValueChange={(v) => setPendingOffset(Math.max(0, Math.floor(v[0] ?? 0)))}
                                />
                            </div>

                            <DialogFooter>
                                <Button
                                    onClick={() => {
                                        const val = Math.max(0, Math.min(pendingOffset, Math.max(0, maxFrames - 1)));
                                        const next = Array.from(new Set([...offsets, val])).sort((a, b) => a - b);
                                        setOffsets(next);
                                        setAddDialogOpen(false);
                                    }}
                                >
                                    Add
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
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
                            <div
                                className="h-[360px] flex items-center justify-center border rounded-md text-sm text-muted-foreground">
                                Select a camera tile from the timeline below.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppShell>
    );
}