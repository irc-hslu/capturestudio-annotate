import type { Rotation, XYXY } from "@/types/detections";

/** Rotate a point (x,y) within an image of size (w,h) by the given UI rotation. */
export function rotatePoint(x: number, y: number, w: number, h: number, rotation: Rotation): [number, number] {
    switch (rotation) {
        case "NONE":
            return [x, y];
        case "90_CLOCKWISE":
            // (x,y) -> (h - y, x)
            return [h - y, x];
        case "90_COUNTERCLOCKWISE":
            // (x,y) -> (y, w - x)
            return [y, w - x];
        case "180":
            // (x,y) -> (w - x, h - y)
            return [w - x, h - y];
    }
}

/** Clamp to image bounds (xyxy). */
export function clampBbox([x1, y1, x2, y2]: XYXY, w: number, h: number): XYXY {
    const cx1 = Math.min(Math.max(0, x1), w);
    const cy1 = Math.min(Math.max(0, y1), h);
    const cx2 = Math.min(Math.max(0, x2), w);
    const cy2 = Math.min(Math.max(0, y2), h);
    const nx1 = Math.min(cx1, cx2);
    const ny1 = Math.min(cy1, cy2);
    const nx2 = Math.max(cx1, cx2);
    const ny2 = Math.max(cy1, cy2);
    return [nx1, ny1, nx2, ny2];
}

/** Rotate an XYXY bbox by sampling its four corners and refitting. */
export function rotateBboxXYXY(b: XYXY, w: number, h: number, rotation: Rotation): XYXY {
    const [x1, y1, x2, y2] = b;
    const corners: [number, number][] = [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2],
    ].map(([x, y]) => rotatePoint(x, y, w, h, rotation));
    const xs = corners.map((p) => p[0]);
    const ys = corners.map((p) => p[1]);
    const rx1 = Math.min(...xs);
    const ry1 = Math.min(...ys);
    const rx2 = Math.max(...xs);
    const ry2 = Math.max(...ys);

    // After 90° rotations the image dims swap.
    const [rw, rh] = rotation === "NONE" || rotation === "180" ? [w, h] : [h, w];
    return clampBbox([rx1, ry1, rx2, ry2], rw, rh);
}

/** Rotate a set of points. */
export function rotatePoints(pts: number[][], w: number, h: number, rotation: Rotation): number[][] {
    return pts.map(([x, y]) => rotatePoint(x, y, w, h, rotation));
}

/** Helper to rename keys for persistence under rotation. */
export function renameKeysForRotation(obj: Record<string, any>, rotation: Rotation): Record<string, any> {
    if (rotation === "NONE") return obj;
    const out = { ...obj };
    if ("bbox" in out && Array.isArray(out.bbox)) {
        out[`bbox_rotated_${rotation}`] = out.bbox;
        delete out.bbox;
    }
    if ("points" in out && Array.isArray(out.points)) {
        out[`points_rotated_${rotation}`] = out.points;
        delete out.points;
    }
    return out;
}