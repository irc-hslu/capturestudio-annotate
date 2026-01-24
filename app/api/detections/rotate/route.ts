import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

async function ensureDir(p: string) {
    await fs.mkdir(p, { recursive: true }).catch(() => {});
}

async function getFirstStem(sessionPath: string, camIdx: number) {
    const colorDir = path.join(sessionPath, "orbbec", `cam${String(camIdx).padStart(2, "0")}`, "color");
    try {
        const files = (await fs.readdir(colorDir))
            .filter(f => f.toLowerCase().endsWith(".jpg"))
            .sort((a, b) => a.localeCompare(b));
        return files.length ? files[0].replace(/\.[^.]+$/, "") : null;
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { sessionPath, camIdx, rotation, firstStem } = await req.json();

        if (!sessionPath || camIdx == null) {
            return NextResponse.json({ error: "sessionPath and camIdx are required" }, { status: 400 });
        }

        const cam = String(parseInt(camIdx, 10)).padStart(2, "0");
        const baseStem = firstStem ?? (await getFirstStem(sessionPath, parseInt(cam, 10)));
        if (!baseStem) {
            return NextResponse.json({ error: "Cannot determine firstStem; no images found" }, { status: 400 });
        }

        const detDir = path.join(sessionPath, "orbbec", `cam${cam}`, "mask");
        await ensureDir(detDir);
        const metaPath = path.join(detDir, `detections-${baseStem}.meta.json`);

        if (rotation) {
            await fs.writeFile(metaPath, JSON.stringify({ rotation }, null, 2), "utf-8");
            return NextResponse.json({ ok: true, rotation });
        } else {
            try {
                const raw = await fs.readFile(metaPath, "utf-8");
                const v = JSON.parse(raw);
                return NextResponse.json({ rotation: v?.rotation ?? null });
            } catch {
                return NextResponse.json({ rotation: null });
            }
        }
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
    }
}