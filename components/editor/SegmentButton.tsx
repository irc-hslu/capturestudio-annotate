"use client";

import {useCallback, useMemo, useState} from "react";
import {Button} from "@/components/ui/button";
import {toast} from "sonner";
import type {CamInfo} from "@/types/session";
import type {DetectionItem, Rotation} from "@/types/detections";
import {useEditor} from "@/store/useEditor";
import {useDetections} from "@/store/useDetections";

function getRotatedKey<T extends "bbox" | "points">(base: T, rotation: Rotation): T | `${T}_rotated_${Rotation}` {
    if (rotation === "NONE") return base;
    return `${base}_rotated_${rotation}` as any;
}

export function SegmentButton({sessionPath, cam, t}: {
    sessionPath: string;
    cam: CamInfo;
    t: number;
}) {
    const {
        rotation,
        maskAvailable,
        maskDirty,
        setMaskAvailable,
        setMaskUrl,
        setMaskDirty,
        setShowMask,
    } = useEditor();

    // subscribe to the current detections array for this camera/stem only
    const itemsKey = `${cam.idx}:${cam.firstStem ?? "t0"}`;
    const selectItems = useCallback((s: any) => s.getForKey(itemsKey), [itemsKey]);
    // const referentialEqual = (a: any, b: any) => a === b;
    const items: DetectionItem[] = useDetections(selectItems);

    const [busy, setBusy] = useState(false);

    // rotated view of items
    const itemsForView = useMemo(() => {
        const bboxKey = getRotatedKey("bbox", rotation) as keyof DetectionItem;
        const pointsKey = getRotatedKey("points", rotation) as keyof DetectionItem;
        return items.map((it) => {
            const bbox = (it as any)[bboxKey] ?? undefined;
            const points = (it as any)[pointsKey] ?? undefined;
            return {...it, bbox, points};
        });
    }, [items, rotation]);

    // collect bboxes (ints) and merge all points into a single group
    const {bboxes, points, point_labels} = useMemo(() => {
        const bb: [number, number, number, number][] = [];
        const allPts: [number, number][] = [];
        const allLbls: number[] = [];

        for (const d of itemsForView) {
            if (d.bbox && d.bbox.length === 4) {
                bb.push([
                    Math.round(Number(d.bbox[0])),
                    Math.round(Number(d.bbox[1])),
                    Math.round(Number(d.bbox[2])),
                    Math.round(Number(d.bbox[3])),
                ]);
            }
        }
        for (const d of itemsForView) {
            const pts = (d as any).points as number[][] | undefined;
            const lbl = d.point_labels as number[] | undefined;
            if (pts && pts.length) {
                for (let i = 0; i < pts.length; i++) {
                    const p = pts[i];
                    const l = lbl?.[i] ?? 1;
                    allPts.push([Math.round(Number(p[0])), Math.round(Number(p[1]))]);
                    allLbls.push(l ? 1 : 0);
                }
            }
        }
        return {
            bboxes: bb,
            points: allPts.length ? allPts : undefined,
            point_labels: allPts.length ? allLbls : undefined,
        };
    }, [itemsForView]);

    // Enable if: not busy AND (mask invalid OR no mask yet)
    const canRun = !busy && (maskDirty || !maskAvailable);

    const run = useCallback(async () => {
        try {
            setBusy(true);

            const res = await fetch("/api/segment", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    sessionPath,
                    camIdx: cam.idx,
                    t,
                    rotation,
                    bboxes,
                    points,
                    point_labels,
                }),
            });
            const js = await res.json();
            if (!res.ok) {
                toast.error(js?.error ?? "Segmentation failed");
                setBusy(false);
                return;
            }

            if (js?.maskUrl) {
                // new mask produced -> treat as valid & clean
                setMaskAvailable(true);
                setMaskUrl(js.maskUrl);
                setMaskDirty(false);
                setShowMask(true); // optional: auto-show; remove if you prefer manual toggle
                toast.success("Mask updated.");
            } else {
                toast.message("No mask returned.");
            }
        } catch (e: any) {
            toast.error(String(e?.message ?? e));
        } finally {
            setBusy(false);
        }
    }, [sessionPath, cam.idx, t, rotation, bboxes, points, point_labels, setMaskAvailable, setMaskUrl, setMaskDirty, setShowMask]);

    return (
        <Button onClick={run} disabled={!canRun} variant="default">
            {busy ? "Segmenting…" : "Segment"}
        </Button>
    );
}