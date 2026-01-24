import path from "path";
import { promises as fs } from "fs";
import { rotationMetaPath } from "@/lib/paths";
import { atomicWriteJson, ensureMaskDir } from "./session";
import type { Rotation } from "@/types/detections";

/** Persist/get rotation metadata for a cam+stem. */
export async function setRotation(sessionPath: string, camIdx: number, stem: string, rotation: Rotation) {
    await ensureMaskDir(sessionPath, camIdx);
    const p = rotationMetaPath(sessionPath, camIdx, stem);
    await atomicWriteJson(p, { rotation });
}

export async function getRotation(sessionPath: string, camIdx: number, stem: string): Promise<Rotation> {
    const p = rotationMetaPath(sessionPath, camIdx, stem);
    try {
        const raw = await fs.readFile(p, "utf8");
        const js = JSON.parse(raw);
        const r = js?.rotation;
        if (r === "NONE" || r === "90_COUNTERCLOCKWISE" || r === "90_CLOCKWISE" || r === "180") return r;
        return "NONE";
    } catch {
        return "NONE";
    }
}