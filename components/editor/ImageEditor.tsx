"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useEditor } from "@/store/useEditor";
import { useClasses } from "@/store/useClasses";
import { useDetections } from "@/store/useDetections";
import { Card } from "@/components/ui/card";
const AnnotationCanvas = dynamic(() => import("./AnnotationCanvas").then((m) => m.AnnotationCanvas), { ssr: false });
import { BBoxListPanel } from "./BBoxListPanel";
import { PointsListPanel } from "./PointsListPanel";
import { Toolbar } from "./Toolbar";
import { SegmentButton } from "./SegmentButton";
import { MaskOverlay } from "./MaskOverlay";
import { Separator } from "@/components/ui/separator";
import type { DetectionItem, Rotation } from "@/types/detections";
import type { CamInfo } from "@/types/session";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// rotation helper for dynamic key
function getRotatedKey<T extends "bbox" | "points">(base: T, rotation: Rotation): T | `${T}_rotated_${Rotation}` {
    if (rotation === "NONE") return base;
    return `${base}_rotated_${rotation}` as any;
}

function extractRotationView(items: DetectionItem[], rotation: Rotation) {
    const bboxKey = getRotatedKey("bbox", rotation) as keyof DetectionItem;
    const pointsKey = getRotatedKey("points", rotation) as keyof DetectionItem;
    return items.map((it) => {
        const bbox = (it as any)[bboxKey] ?? undefined;
        const points = (it as any)[pointsKey] ?? undefined;
        return { ...it, bbox, points };
    });
}

export function ImageEditor({
                                sessionPath,
                                cam,
                                t,
                            }: {
    sessionPath: string;
    cam: CamInfo;
    t: number;
}) {
    const {
        rotation,
        showMask,
        setShowMask,
        maskAvailable,
        setMaskAvailable,
        maskUrl,
        setMaskUrl,
        invalidateMask,
        setMaskDirty,
    } = useEditor();

    const { classes, activeClassId } = useClasses();

    // detections store: subscribe only to this key's array
    const itemsKey = `${cam.idx}:${cam.firstStem ?? "t0"}`;
    const selectItems = useCallback((s: any) => s.getForKey(itemsKey), [itemsKey]);
    const items: DetectionItem[] = useDetections(selectItems);
    const setForKey = useDetections((s) => s.setForKey);

    const [imgUrl, setImgUrl] = useState<string | null>(null);
    const [loadingImg, setLoadingImg] = useState(true);
    const [editIndex, setEditIndex] = useState<number | null>(null); // selection index for editing a bbox (draggable/transformer)
    const [detecting, setDetecting] = useState(false); // NEW: track in-flight detection

    // host ref for both canvas and overlay (so they share identical geometry)
    const hostRef = useRef<HTMLDivElement>(null);

    // load detections once per cam/stem
    useEffect(() => {
        let aborted = false;
        (async () => {
            if (!cam.firstStem) return;
            const res = await fetch(
                `/api/detections/get?sessionPath=${encodeURIComponent(sessionPath)}&camIdx=${cam.idx}&stem=${cam.firstStem}`
            );
            const js = await res.json();
            if (!aborted) setForKey(itemsKey, js.detections ?? []);
        })();
        return () => {
            aborted = true;
        };
    }, [sessionPath, cam.idx, cam.firstStem, itemsKey, setForKey]);

    // load image (original; UI rotates visually)
    useEffect(() => {
        let aborted = false;
        setLoadingImg(true);
        setImgUrl(null);
        (async () => {
            const url = `/api/image?sessionPath=${encodeURIComponent(sessionPath)}&camIdx=${cam.idx}&t=${t}`;
            const r = await fetch(url);
            if (!r.ok) {
                if (!aborted) setLoadingImg(false);
                return;
            }
            const blob = await r.blob();
            if (!aborted) {
                setImgUrl(URL.createObjectURL(blob));
                setLoadingImg(false);
            }
        })();
        return () => {
            aborted = true;
        };
    }, [sessionPath, cam.idx, t]);

    // check for existing mask on load (do not show by default)
    useEffect(() => {
        let aborted = false;
        (async () => {
            if (!cam.firstStem) {
                setMaskAvailable(false);
                setMaskUrl(null);
                // reset mask state on image change
                setShowMask(false);
                setMaskDirty(false);
                return;
            }
            const url = `/api/mask/get?sessionPath=${encodeURIComponent(sessionPath)}&camIdx=${cam.idx}&stem=${cam.firstStem}&v=${Date.now()}`;
            const res = await fetch(url, { method: "GET" });
            if (!aborted) {
                if (res.ok) {
                    setMaskAvailable(true);
                    setMaskUrl(url);
                } else {
                    setMaskAvailable(false);
                    setMaskUrl(null);
                }
                // always start “clean” and hidden on image load
                setShowMask(false);
                setMaskDirty(false);
            }
        })();
        return () => {
            aborted = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionPath, cam.idx, cam.firstStem]);

    const itemsForView = useMemo(() => extractRotationView(items, rotation), [items, rotation]);

    // invalidate mask on any bbox/points change helpers
    const upsert = useCallback(
        async (item: DetectionItem, index?: number | null) => {
            if (!cam.firstStem) return;
            const body = {
                sessionPath,
                camIdx: cam.idx,
                stem: cam.firstStem,
                index: index ?? null,
                rotation,
                frameIdx: t, // relative frame offset
                item,
            };
            const res = await fetch("/api/detections/upsert", { method: "POST", body: JSON.stringify(body) });
            if (!res.ok) {
                toast.error("Failed to save detection.");
                return;
            }
            const js = await res.json();
            setForKey(itemsKey, js.detections ?? []);
            // any edit -> invalidate current mask & hide overlay
            invalidateMask();
        },
        [cam.idx, cam.firstStem, sessionPath, rotation, t, setForKey, itemsKey, invalidateMask]
    );

    const remove = useCallback(
        async (index: number) => {
            if (!cam.firstStem) return;
            const res = await fetch("/api/detections/delete", {
                method: "POST",
                body: JSON.stringify({ sessionPath, camIdx: cam.idx, stem: cam.firstStem, index }),
            });
            if (!res.ok) {
                toast.error("Failed to delete detection.");
                return;
            }
            const js = await res.json();
            setForKey(itemsKey, js.detections ?? []);
            invalidateMask();
            setEditIndex((prev) => (prev === index ? null : prev));
        },
        [cam.firstStem, sessionPath, cam.idx, setForKey, itemsKey, invalidateMask]
    );

    const detectPersons = useCallback(async () => {
        setDetecting(true); // NEW
        try {
            const res = await fetch("/api/detect", {
                method: "POST",
                body: JSON.stringify({
                    sessionPath,
                    camIdx: cam.idx,
                    t,
                    rotation, // server rotates pixels for inference
                }),
            });
            if (!res.ok) {
                toast.error("Detection failed.");
                return;
            }
            const js = await res.json();
            const preds: DetectionItem[] = js.detections ?? [];
            for (const d of preds) await upsert(d, null);
            toast.success(`Added ${preds.length} detections`);
        } finally {
            setDetecting(false); // NEW
        }
    }, [sessionPath, cam.idx, t, rotation, upsert]);

    const activeClass = classes.find((c) => c.id === (activeClassId ?? -1));

    // disable all editing when mask is visible
    const editingDisabled = showMask;

    const appendPointToSingleGroup = useCallback(
        async (pt: [number, number], label: 0 | 1) => {
            const groupIdxInView = itemsForView.findIndex(
                (it) => Array.isArray((it as any).points) && (it as any).points.length > 0
            );

            if (groupIdxInView >= 0) {
                const base = items[groupIdxInView];
                const prevPts =
                    ((base as any)[getRotatedKey("points", rotation)] as number[][] | undefined) ??
                    (base.points as number[][] | undefined) ??
                    [];
                const prevLbl = (base.point_labels as number[] | undefined) ?? new Array(prevPts.length).fill(1);

                await upsert(
                    {
                        ...base,
                        points: [...prevPts, [Math.round(pt[0]), Math.round(pt[1])]],
                        point_labels: [...prevLbl, label],
                    },
                    groupIdxInView
                );
            } else {
                await upsert({
                    points: [[Math.round(pt[0]), Math.round(pt[1])]],
                    point_labels: [label],
                    confidence: 1.0,
                    class_name: "point",
                    class_id: 0,
                });
            }
        },
        [items, itemsForView, rotation, upsert]
    );

    return (
        <div className="grid grid-cols-12 gap-4 h-full">
            {/* Canvas + HUD */}
            <Card className="col-span-8 p-2 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between">
                    {/* pass disabled + detecting to Toolbar */}
                    <Toolbar onDetect={detectPersons} disabled={editingDisabled} detecting={detecting} />
                    <div className="flex items-center gap-3">
                        {/* Show Mask switch only if a mask exists */}
                        {maskAvailable && (
                            <div className="flex items-center gap-2">
                                <Switch checked={showMask} onCheckedChange={setShowMask} />
                                <Label className="text-sm">Show Mask</Label>
                            </div>
                        )}
                        <SegmentButton sessionPath={sessionPath} cam={cam} t={t} />
                    </div>
                </div>
                <Separator className="my-2" />
                {/* Host wraps both canvas and overlay so their geometry matches */}
                <div ref={hostRef} className="relative flex-1 min-h-0">
                    <AnnotationCanvas
                        key={`${cam.idx}-${t}`} // reset per image
                        imageUrl={imgUrl}
                        loading={loadingImg}
                        rotation={rotation}
                        detections={itemsForView}
                        hideAnnotations={showMask} // hide shapes when showing mask
                        editIndex={editIndex}
                        onEditIndexCleared={() => setEditIndex(null)}
                        onCreateBBox={async (xyxy) => {
                            if (!activeClass) {
                                toast.message("Select a class first");
                                return;
                            }
                            await upsert({
                                bbox: xyxy.map((v) => Math.round(Number(v))) as [number, number, number, number],
                                confidence: 1.0,
                                class_name: activeClass.name,
                                class_id: activeClass.id,
                            });
                        }}
                        onCreatePoint={async ({ x, y, label }) => {
                            await appendPointToSingleGroup([x, y], label);
                        }}
                        onUpdateBBox={async (index, xyxy) => {
                            const base = items[index];
                            await upsert({ ...base, bbox: xyxy.map((v) => Math.round(Number(v))) as any }, index);
                        }}
                    />

                    {/* Pink background overlay masked by FG */}
                    <MaskOverlay
                        containerRef={hostRef}
                        imageUrl={imgUrl}
                        maskUrl={showMask ? maskUrl : null}
                        show={!!showMask && !!maskUrl}
                        pinkAlpha={0.8}
                    />
                </div>
            </Card>

            {/* Right side panels */}
            <div className="col-span-4 flex flex-col gap-4 min-h-0">
                {/* Boxes panel */}
                <Card className="p-3 min-h-0 flex-1 flex flex-col overflow-hidden">
                    <h3 className="text-sm font-semibold mb-2">Boxes</h3>
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto pr-2">
                            <BBoxListPanel
                                items={itemsForView}
                                disabled={editingDisabled}
                                onDelete={remove}
                                onChange={async (index, xyxy) => {
                                    const base = items[index];
                                    await upsert({ ...base, bbox: xyxy.map((v) => Math.round(Number(v))) as any }, index);
                                }}
                                onEnterEdit={(index) => {
                                    if (showMask) setShowMask(false);
                                    setEditIndex(index);
                                }}
                            />
                        </div>
                    </div>
                </Card>

                {/* Points panel */}
                <Card className="p-3 min-h-0 flex-1 flex flex-col overflow-hidden">
                    <h3 className="text-sm font-semibold mb-2">Points</h3>
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto pr-2">
                            <PointsListPanel
                                items={itemsForView}
                                disabled={editingDisabled}
                                onDelete={remove}
                                onAppendPoint={async (index, pt, label) => {
                                    const base = items[index];
                                    const prevPts = (base as any)[getRotatedKey("points", rotation)] ?? base.points ?? [];
                                    const prevLbl = base.point_labels ?? new Array(prevPts.length).fill(1);
                                    await upsert(
                                        {
                                            ...base,
                                            points: [...prevPts, [Math.round(pt[0]), Math.round(pt[1])]],
                                            point_labels: [...prevLbl, label],
                                        },
                                        index
                                    );
                                }}
                                onUpdatePoint={async (index, pIdx, pt, label) => {
                                    const base = items[index];
                                    const prevPts = (base as any)[getRotatedKey("points", rotation)] ?? base.points ?? [];
                                    const prevLbl = base.point_labels ?? new Array(prevPts.length).fill(1);
                                    const nextPts = prevPts.map((p: number[], i: number) =>
                                        i === pIdx ? [Math.round(pt[0]), Math.round(pt[1])] : p
                                    );
                                    const nextLbl = prevLbl.map((l: number, i: number) => (i === pIdx ? (label ? 1 : 0) : l));
                                    await upsert({ ...base, points: nextPts, point_labels: nextLbl }, index);
                                }}
                                onRemovePoint={async (index, pIdx) => {
                                    const base = items[index];
                                    const prevPts = (base as any)[getRotatedKey("points", rotation)] ?? base.points ?? [];
                                    const prevLbl = base.point_labels ?? new Array(prevPts.length).fill(1);
                                    const nextPts = prevPts.filter((_: any, i: number) => i !== pIdx);
                                    const nextLbl = prevLbl.filter((_: any, i: number) => i !== pIdx);
                                    await upsert({ ...base, points: nextPts, point_labels: nextLbl }, index);
                                }}
                            />
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}