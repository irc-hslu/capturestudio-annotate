/**
 * Person detector wrapper.
 * Replace `runPersonModel` with your implementation. This wrapper rotates pixels first
 * (so the model sees the same orientation the user sees) and returns XYXY boxes
 * already aligned to the rotated UI coordinate system.
 */

import { promises as fs } from "fs";
import type { Rotation, DetectionItem } from "@/types/detections";

type PersonModelFn = (
    imageBytes: Buffer
) => Promise<{ bbox: [number, number, number, number]; score: number }[]>;

// TODO: wire your actual detector here.
let runPersonModel: PersonModelFn | null = null;
// Example:
// import { runModel } from "@/server/person_model";
// runPersonModel = runModel;

async function rotateBuffer(buf: Buffer, rotation: Rotation): Promise<Buffer> {
    if (rotation === "NONE") return buf;
    const sharpMod = await import("sharp").catch(() => null as any);
    if (!sharpMod) return buf;
    const sharp = sharpMod.default || sharpMod;
    const img = sharp(buf);
    if (rotation === "90_CLOCKWISE") return await img.rotate(90).toBuffer();
    if (rotation === "90_COUNTERCLOCKWISE") return await img.rotate(-90).toBuffer();
    if (rotation === "180") return await img.rotate(180).toBuffer();
    return buf;
}

export async function detectPersons(params: {
    imagePath: string;
    rotation: Rotation;
    className?: string;
    classId?: number;
}): Promise<DetectionItem[]> {
    if (!runPersonModel) {
        throw new Error("runPersonModel() is not wired. Please bind your detector in lib/detect.ts.");
    }
    const bytes = await fs.readFile(params.imagePath);
    const rotated = await rotateBuffer(bytes, params.rotation);
    const preds = await runPersonModel(rotated);

    const clsName = params.className ?? "person";
    const clsId = params.classId ?? 0;

    return preds.map((p) => ({
        bbox: p.bbox, // already in rotated coords
        confidence: p.score ?? 1.0,
        class_name: clsName,
        class_id: clsId,
    }));
}