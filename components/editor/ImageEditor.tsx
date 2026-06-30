"use client";

import {useEffect, useMemo, useState, useCallback, useRef} from "react";
import dynamic from "next/dynamic";
import {useEditor} from "@/store/useEditor";
import {useClasses} from "@/store/useClasses";
import {useDetections} from "@/store/useDetections";
import {Card} from "@/components/ui/card";

const AnnotationCanvas = dynamic(() => import("./AnnotationCanvas").then((m) => m.AnnotationCanvas), {ssr: false});
import {BBoxListPanel} from "./BBoxListPanel";
import {PointsListPanel} from "./PointsListPanel";
import {Toolbar} from "./Toolbar";
import {SegmentButton} from "./SegmentButton";
import {MaskOverlay} from "./MaskOverlay";
import {Separator} from "@/components/ui/separator";
import type {DetectionItem, Rotation} from "@/types/detections";
import type {CamInfo} from "@/types/session";
import {toast} from "sonner";
import {Switch} from "@/components/ui/switch";
import {Label} from "@/components/ui/label";

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
        return {...it, bbox, points};
    });
}

function frameIdxOf(it: DetectionItem): number {
    const v = (it as any).frame_idx;
    return typeof v === "number" ? Math.floor(v) : 0;
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

    const {classes, activeClassId} = useClasses();

    const itemsKey = `${cam.idx}:${cam.firstStem ?? "t0"}`;
    const selectItems = useCallback((s: any) => s.getForKey(itemsKey), [itemsKey]);
    const items: DetectionItem[] = useDetections(selectItems) as any;
    const setForKey = useDetections((s) => s.setForKey);

    const [imgUrl, setImgUrl] = useState<string | null>(null);
    const [loadingImg, setLoadingImg] = useState(true);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [detecting, setDetecting] = useState(false);

    const hostRef = useRef<HTMLDivElement>(null);

    const currentStem = useMemo(() => {
        const stem = (cam as any)?.frames?.[t]?.stem;
        return typeof stem === "string" && stem.length ? stem : cam.firstStem;
    }, [cam, t]);

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

    useEffect(() => {
        let aborted = false;
        (async () => {
            if (!currentStem) {
                setMaskAvailable(false);
                setMaskUrl(null);
                setShowMask(false);
                setMaskDirty(false);
                return;
            }
            const url = `/api/mask/get?sessionPath=${encodeURIComponent(sessionPath)}&camIdx=${cam.idx}&stem=${currentStem}&v=${Date.now()}`;
            const res = await fetch(url, {method: "GET"});
            if (!aborted) {
                if (res.ok) {
                    setMaskAvailable(true);
                    setMaskUrl(url);
                } else {
                    setMaskAvailable(false);
                    setMaskUrl(null);
                }
                setShowMask(false);
                setMaskDirty(false);
            }
        })();
        return () => {
            aborted = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionPath, cam.idx, currentStem]);

    const frameGlobalIdxs = useMemo(() => {
        const out: number[] = [];
        for (let i = 0; i < items.length; i++) {
            if (frameIdxOf(items[i]) === t) out.push(i);
        }
        return out;
    }, [items, t]);

    const frameItems = useMemo(() => frameGlobalIdxs.map((gi) => items[gi]), [frameGlobalIdxs, items]);
    const frameItemsForView = useMemo(() => extractRotationView(frameItems, rotation), [frameItems, rotation]);

    const globalIndexFromLocal = useCallback(
        (localIdx: number) => frameGlobalIdxs[localIdx],
        [frameGlobalIdxs]
    );

    const upsert = useCallback(
        async (item: DetectionItem, globalIndex?: number | null) => {
            if (!cam.firstStem) return;
            const body = {
                sessionPath,
                camIdx: cam.idx,
                stem: cam.firstStem,
                index: globalIndex ?? null,
                rotation,
                frameIdx: t,
                item,
            };
            const res = await fetch("/api/detections/upsert", {method: "POST", body: JSON.stringify(body)});
            if (!res.ok) {
                toast.error("Failed to save detection.");
                return;
            }
            const js = await res.json();
            setForKey(itemsKey, js.detections ?? []);
            invalidateMask();
        },
        [cam.idx, cam.firstStem, sessionPath, rotation, t, setForKey, itemsKey, invalidateMask]
    );

    const removeLocal = useCallback(
        async (localIndex: number) => {
            if (!cam.firstStem) return;
            const globalIndex = globalIndexFromLocal(localIndex);
            if (globalIndex == null) return;

            const res = await fetch("/api/detections/delete", {
                method: "POST",
                body: JSON.stringify({sessionPath, camIdx: cam.idx, stem: cam.firstStem, index: globalIndex}),
            });
            if (!res.ok) {
                toast.error("Failed to delete detection.");
                return;
            }
            const js = await res.json();
            setForKey(itemsKey, js.detections ?? []);
            invalidateMask();
            setEditIndex((prev) => (prev === localIndex ? null : prev));
        },
        [cam.firstStem, sessionPath, cam.idx, setForKey, itemsKey, invalidateMask, globalIndexFromLocal]
    );

    const classNames = useMemo(() => {
        const names = classes
            .map((c) => String((c as any)?.name ?? "").trim())
            .filter((s) => s.length > 0);
        return Array.from(new Set(names));
    }, [classes]);

    const detectPersons = useCallback(async () => {
        setDetecting(true);
        try {
            const res = await fetch("/api/detect", {
                method: "POST",
                body: JSON.stringify({
                    sessionPath,
                    camIdx: cam.idx,
                    t,
                    rotation,
                    classNames,
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
            setDetecting(false);
        }
    }, [sessionPath, cam.idx, t, rotation, classNames, upsert]);

    const activeClass = classes.find((c) => c.id === (activeClassId ?? -1));
    const editingDisabled = showMask;

    const appendPointToSingleGroup = useCallback(
        async (pt: [number, number], label: 0 | 1) => {
            const groupIdxInView = frameItemsForView.findIndex(
                (it) => Array.isArray((it as any).points) && (it as any).points.length > 0
            );

            if (groupIdxInView >= 0) {
                const globalIndex = globalIndexFromLocal(groupIdxInView);
                const base = frameItems[groupIdxInView];

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
                    globalIndex
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
        [frameItems, frameItemsForView, rotation, upsert, globalIndexFromLocal]
    );

    return (
        <div className="grid grid-cols-12 gap-4 h-full">
            <Card className="col-span-8 p-2 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between">
                    <Toolbar onDetect={detectPersons} disabled={editingDisabled} detecting={detecting}/>
                    <div className="flex items-center gap-3">
                        {maskAvailable && (
                            <div className="flex items-center gap-2">
                                <Switch checked={showMask} onCheckedChange={setShowMask}/>
                                <Label className="text-sm">Show Mask</Label>
                            </div>
                        )}
                        <SegmentButton sessionPath={sessionPath} cam={cam} t={t}/>
                    </div>
                </div>
                <Separator className="my-2"/>
                <div ref={hostRef} className="relative flex-1 min-h-0">
                    <AnnotationCanvas
                        key={`${cam.idx}-${t}`}
                        imageUrl={imgUrl}
                        loading={loadingImg}
                        rotation={rotation}
                        detections={frameItemsForView}
                        hideAnnotations={showMask}
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
                        onCreatePoint={async ({x, y, label}) => {
                            await appendPointToSingleGroup([x, y], label);
                        }}
                        onUpdateBBox={async (localIndex, xyxy) => {
                            const globalIndex = globalIndexFromLocal(localIndex);
                            const base = frameItems[localIndex];
                            await upsert({...base, bbox: xyxy.map((v) => Math.round(Number(v))) as any}, globalIndex);
                        }}
                    />

                    <MaskOverlay
                        containerRef={hostRef}
                        imageUrl={imgUrl}
                        maskUrl={showMask ? maskUrl : null}
                        show={!!showMask && !!maskUrl}
                        pinkAlpha={0.8}
                    />
                </div>
            </Card>

            <div className="col-span-4 flex flex-col gap-4 min-h-0">
                <Card className="p-3 min-h-0 flex-1 flex flex-col overflow-hidden">
                    <h3 className="text-sm font-semibold mb-2">Boxes</h3>
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto pr-2">
                            <BBoxListPanel
                                items={frameItemsForView}
                                disabled={editingDisabled}
                                onDelete={removeLocal}
                                onChange={async (localIndex, xyxy) => {
                                    const globalIndex = globalIndexFromLocal(localIndex);
                                    const base = frameItems[localIndex];
                                    await upsert({
                                        ...base,
                                        bbox: xyxy.map((v) => Math.round(Number(v))) as any
                                    }, globalIndex);
                                }}
                                onEnterEdit={(localIndex) => {
                                    if (showMask) setShowMask(false);
                                    setEditIndex(localIndex);
                                }}
                            />
                        </div>
                    </div>
                </Card>

                <Card className="p-3 min-h-0 flex-1 flex flex-col overflow-hidden">
                    <h3 className="text-sm font-semibold mb-2">Points</h3>
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto pr-2">
                            <PointsListPanel
                                items={frameItemsForView}
                                disabled={editingDisabled}
                                onDelete={removeLocal}
                                onAppendPoint={async (localIndex, pt, label) => {
                                    const globalIndex = globalIndexFromLocal(localIndex);
                                    const base = frameItems[localIndex];
                                    const prevPts = (base as any)[getRotatedKey("points", rotation)] ?? base.points ?? [];
                                    const prevLbl = base.point_labels ?? new Array(prevPts.length).fill(1);
                                    await upsert(
                                        {
                                            ...base,
                                            points: [...prevPts, [Math.round(pt[0]), Math.round(pt[1])]],
                                            point_labels: [...prevLbl, label],
                                        },
                                        globalIndex
                                    );
                                }}
                                onUpdatePoint={async (localIndex, pIdx, pt, label) => {
                                    const globalIndex = globalIndexFromLocal(localIndex);
                                    const base = frameItems[localIndex];
                                    const prevPts = (base as any)[getRotatedKey("points", rotation)] ?? base.points ?? [];
                                    const prevLbl = base.point_labels ?? new Array(prevPts.length).fill(1);
                                    const nextPts = prevPts.map((p: number[], i: number) =>
                                        i === pIdx ? [Math.round(pt[0]), Math.round(pt[1])] : p
                                    );
                                    const nextLbl = prevLbl.map((l: number, i: number) => (i === pIdx ? (label ? 1 : 0) : l));
                                    await upsert({...base, points: nextPts, point_labels: nextLbl}, globalIndex);
                                }}
                                onRemovePoint={async (localIndex, pIdx) => {
                                    const globalIndex = globalIndexFromLocal(localIndex);
                                    const base = frameItems[localIndex];
                                    const prevPts = (base as any)[getRotatedKey("points", rotation)] ?? base.points ?? [];
                                    const prevLbl = base.point_labels ?? new Array(prevPts.length).fill(1);
                                    const nextPts = prevPts.filter((_: any, i: number) => i !== pIdx);
                                    const nextLbl = prevLbl.filter((_: any, i: number) => i !== pIdx);
                                    await upsert({...base, points: nextPts, point_labels: nextLbl}, globalIndex);
                                }}
                            />
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}