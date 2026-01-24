"use client";

import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/store/useEditor";
import { useDetections } from "@/store/useDetections";
import type { Rotation } from "@/types/detections";
import type { CamInfo } from "@/types/session";
import { toast } from "sonner";

function gatherForBackend(
    detections: any[],
    rotation: Rotation
): { bboxes: number[][]; points: number[][]; labels: number[] } {
    const bboxKey = rotation === "NONE" ? "bbox" : `bbox_rotated_${rotation}`;
    const ptsKey = rotation === "NONE" ? "points" : `points_rotated_${rotation}`;

    const bboxes: number[][] = [];
    const points: number[][] = [];
    const labels: number[] = [];

    for (const it of detections) {
        const b = it?.[bboxKey] ?? it?.bbox;
        if (Array.isArray(b) && b.length === 4) {
            // store as integers per your latest requirement
            bboxes.push(b.map((v: number) => Math.round(v)));
        }

        const pts: number[][] | undefined = it?.[ptsKey] ?? it?.points;
        const lbls: number[] | undefined = it?.point_labels;
        if (pts && pts.length) {
            for (let i = 0; i < pts.length; i++) {
                const p = pts[i];
                const lab = (lbls?.[i] ?? 1) ? 1 : 0;
                if (Array.isArray(p) && p.length === 2) {
                    points.push([Math.round(p[0]), Math.round(p[1])]);
                    labels.push(lab);
                }
            }
        }
    }

    return { bboxes, points, labels };
}

export function SegmentButton({sessionPath, cam, t}: {
    sessionPath: string;
    cam: CamInfo;
    t: number;
}) {
    const {
        rotation,
        isSegmenting,
        maskAvailable,
        maskDirty,
        setIsSegmenting,
        setMaskAvailable,
        setMaskDirty,
        setMaskUrl,
    } = useEditor();

    const itemsKey = `${cam.idx}:${cam.firstStem ?? "t0"}`;
    const getForKey = useDetections((s) => s.getForKey);
    const detections = useMemo(() => getForKey(itemsKey), [getForKey, itemsKey]);

    const disabled = isSegmenting || (maskAvailable && !maskDirty);

    const onSegment = useCallback(async () => {
        if (!cam.firstStem) return;
        setIsSegmenting(true);
        try {
            const { bboxes, points, labels } = gatherForBackend(detections, rotation);

            const res = await fetch("/api/segment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionPath,
                    camIdx: cam.idx,
                    t,
                    rotation,
                    stem: cam.firstStem, // save as <stem>.jpg
                    bboxes,
                    points,
                    point_labels: labels,
                }),
            });

            const js = await res.json();
            if (!res.ok || !js?.saved) {
                toast.error(js?.error ?? "Segmentation failed");
                return;
            }

            // refresh mask url (cache-bust via v=...)
            setMaskUrl(String(js.maskUrl));
            setMaskAvailable(true);
            setMaskDirty(false);
            toast.success("Mask updated");
        } catch (e: any) {
            toast.error(String(e?.message ?? e));
        } finally {
            setIsSegmenting(false);
        }
    }, [cam.idx, cam.firstStem, detections, rotation, sessionPath, setIsSegmenting, setMaskAvailable, setMaskDirty, setMaskUrl, t]);

    return (
        <Button variant="default" disabled={disabled} onClick={onSegment}>
            {isSegmenting ? "Segmenting…" : "Apply (Segment)"}
        </Button>
    );
}