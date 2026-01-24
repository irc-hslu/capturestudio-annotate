import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

// GET /api/mask?sessionPath=&camIdx=&t=
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const sessionPath = searchParams.get("sessionPath") ?? "";
    const camIdx = Number(searchParams.get("camIdx") ?? "-1");
    const t = Number(searchParams.get("t") ?? "0");

    if (!sessionPath || camIdx < 0 || Number.isNaN(t)) {
        return NextResponse.json({ url: null }, { status: 200 });
    }

    const cam = String(camIdx).padStart(2, "0");
    const colorDir = path.join(sessionPath, "orbbec", `cam${cam}`, "color");
    let jpgs: string[] = [];
    try {
        jpgs = (await fs.readdir(colorDir))
            .filter((f) => f.toLowerCase().endsWith(".jpg"))
            .sort((a, b) => a.localeCompare(b));
    } catch {
        return NextResponse.json({ url: null }, { status: 200 });
    }
    if (!jpgs.length) return NextResponse.json({ url: null }, { status: 200 });

    const idx = Math.min(Math.max(0, t), jpgs.length - 1);
    const stem = jpgs[idx].replace(/\.[^.]+$/, "");

    const maskPath = path.join(sessionPath, "orbbec", `cam${cam}`, "mask", `${stem}.jpg`);
    try {
        await fs.access(maskPath);
        // stream via /api/mask/file
        const url = `/api/mask/file?sessionPath=${encodeURIComponent(sessionPath)}&camIdx=${camIdx}&t=${t}`;
        return NextResponse.json({ url }, { status: 200 });
    } catch {
        return NextResponse.json({ url: null }, { status: 200 });
    }
}