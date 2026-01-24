import path from "path";
import { promises as fs } from "fs";
import { writeFileAtomic } from "@/lib/io/atomic";
import { colorDirPath, maskDirPath } from "@/lib/paths";
import type { CamFrame, CamInfo } from "@/types/session";

/** Ensure directory exists (mkdir -p). */
export async function ensureDir(p: string) {
    await fs.mkdir(p, { recursive: true });
}

/** Enumerate camera indices by checking orbbec/camXX directory presence. */
export async function enumerateCams(sessionPath: string): Promise<number[]> {
    const base = path.join(sessionPath, "orbbec");
    let entries: string[] = [];
    try {
        entries = await fs.readdir(base);
    } catch {
        return [];
    }
    const camIdxs = entries
        .map((d) => {
            const m = /^cam(\d{2})$/.exec(d);
            return m ? parseInt(m[1], 10) : null;
        })
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b);
    return camIdxs;
}

/** List color JPG frames for a camera, sorted by filename, returning [t, filename, stem]. */
export async function listCamFrames(sessionPath: string, camIdx: number): Promise<CamFrame[]> {
    const dir = colorDirPath(sessionPath, camIdx);
    let files: string[] = [];
    try {
        files = await fs.readdir(dir);
    } catch {
        return [];
    }
    const jpgs = files
        .filter((f) => f.toLowerCase().endsWith(".jpg"))
        .sort((a, b) => a.localeCompare(b));

    return jpgs.map((filename, t) => {
        const stem = filename.replace(/\.[^.]+$/, "");
        return { t, filename, stem };
    });
}

/** Describe all cams with their frame lists and first stem (or null). */
export async function describeSessionCams(sessionPath: string): Promise<CamInfo[]> {
    const idxs = await enumerateCams(sessionPath);
    const cams: CamInfo[] = [];
    for (const idx of idxs) {
        const frames = await listCamFrames(sessionPath, idx);
        const firstStem = frames.length ? frames[0].stem : null;
        cams.push({
            idx,
            colorDir: colorDirPath(sessionPath, idx),
            frames,
            firstStem,
        });
    }
    return cams;
}

/** Resolve the absolute file path for (camIdx, t). */
export async function resolveImagePathByIndex(sessionPath: string, camIdx: number, t: number): Promise<string | null> {
    const frames = await listCamFrames(sessionPath, camIdx);
    if (!frames.length) return null;
    const { filename } = frames[Math.min(Math.max(0, t), frames.length - 1)];
    return path.join(colorDirPath(sessionPath, camIdx), filename);
}

/** First color file stem for a camera, or null. */
export async function firstStemForCam(sessionPath: string, camIdx: number): Promise<string | null> {
    const frames = await listCamFrames(sessionPath, camIdx);
    return frames.length ? frames[0].stem : null;
}

/** Atomic JSON write helper. */
export async function atomicWriteJson(filePath: string, data: unknown) {
    await ensureDir(path.dirname(filePath));
    const json = JSON.stringify(data, null, 2);
    await writeFileAtomic(filePath, json);
}

/** Ensure mask/ directory exists for a camera. */
export async function ensureMaskDir(sessionPath: string, camIdx: number) {
    await ensureDir(maskDirPath(sessionPath, camIdx));
}