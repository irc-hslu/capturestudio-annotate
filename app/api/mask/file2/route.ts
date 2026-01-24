import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

// GET /api/mask/file?sessionPath=&camIdx=&t=
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const sessionPath = searchParams.get("sessionPath") ?? "";
    const camIdx = Number(searchParams.get("camIdx") ?? "-1");
    const t = Number(searchParams.get("t") ?? "0");

    if (!sessionPath || camIdx < 0 || Number.isNaN(t)) {
        return new NextResponse("Bad request", { status: 400 });
    }

    const cam = String(camIdx).padStart(2, "0");
    const colorDir = path.join(sessionPath, "orbbec", `cam${cam}`, "color");
    let jpgs: string[] = [];
    try {
        jpgs = (await fs.readdir(colorDir))
            .filter((f) => f.toLowerCase().endsWith(".jpg"))
            .sort((a, b) => a.localeCompare(b));
    } catch {
        return new NextResponse("Not found", { status: 404 });
    }
    if (!jpgs.length) return new NextResponse("Not found", { status: 404 });

    const idx = Math.min(Math.max(0, t), jpgs.length - 1);
    const stem = jpgs[idx].replace(/\.[^.]+$/, "");
    const maskPath = path.join(sessionPath, "orbbec", `cam${cam}`, "mask", `${stem}.jpg`);

    try {
        const buf = await fs.readFile(maskPath);
        return new NextResponse(buf, {
            status: 200,
            headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
        });
    } catch {
        return new NextResponse("Not found", { status: 404 });
    }
}