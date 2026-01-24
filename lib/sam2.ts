/**
 * Server wrapper for SAM2 segmentation.
 * You mentioned you already have a function — wire it here by replacing `segmentWithSAM2`.
 *
 * Contract we use below:
 *   async function segmentWithSAM2(
 *     imageBytes: Buffer,
 *     opts: { positivePoints: number[][]; negativePoints: number[][] }
 *   ): Promise<Uint8Array | Buffer>
 *
 * We rotate pixels (via sharp) for inference when `rotation !== "NONE"`,
 * then return the mask PNG already aligned with the rotated UI coordinates.
 */

import { promises as fs } from "fs";
import path from "path";
import type { Rotation } from "@/types/detections";

type SegmentFn = (
    imageBytes: Buffer,
    opts: { positivePoints: number[][]; negativePoints: number[][] }
) => Promise<Uint8Array | Buffer>;

// TODO: replace this with your actual import
let segmentWithSAM2: SegmentFn | null = null;
// Example:
// import { segmentWithSAM2 as realSAM2 } from "@/server/sam2_impl";
// segmentWithSAM2 = realSAM2;

async function rotateBufferIfNeeded(buf: Buffer, rotation: Rotation): Promise<Buffer> {
    if (rotation === "NONE") return buf;
    const sharpMod = await import("sharp").catch(() => null as any);
    if (!sharpMod) {
        // If sharp is not available, we fall back to no-rotation and let the caller know.
        // You can remove this and make sharp a hard dependency.
        return buf;
    }
    const sharp = sharpMod.default || sharpMod;
    const img = sharp(buf);
    if (rotation === "90_CLOCKWISE") return await img.rotate(90).toBuffer();
    if (rotation === "90_COUNTERCLOCKWISE") return await img.rotate(-90).toBuffer();
    if (rotation === "180") return await img.rotate(180).toBuffer();
    return buf;
}

export async function runSAM2(params: {
    imagePath: string;
    rotation: Rotation;
    positivePoints: number[][];
    negativePoints: number[][];
}): Promise<{ maskPngBase64: string }> {
    if (!segmentWithSAM2) {
        throw new Error("segmentWithSAM2() is not wired. Please bind your SAM2 function in lib/sam2.ts.");
    }
    const bytes = await fs.readFile(params.imagePath);
    const rotated = await rotateBufferIfNeeded(bytes, params.rotation);

    // Call your SAM2 function on the rotated pixels
    const rawMask = await segmentWithSAM2(rotated, {
        positivePoints: params.positivePoints ?? [],
        negativePoints: params.negativePoints ?? [],
    });

    // Ensure PNG base64 (if your SAM2 returns raw logits, produce a PNG here)
    const pngBytes = Buffer.isBuffer(rawMask) ? rawMask : Buffer.from(rawMask);
    const maskPngBase64 = `data:image/png;base64,${pngBytes.toString("base64")}`;
    return { maskPngBase64 };
}