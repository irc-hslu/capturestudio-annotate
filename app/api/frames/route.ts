import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

async function listJpgsSorted(dir: string) {
    try {
        const files = await fs.readdir(dir);
        return files.filter(f => f.toLowerCase().endsWith(".jpg")).sort((a, b) => a.localeCompare(b));
    } catch {
        return [];
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const sessionPath = searchParams.get("sessionPath");
        const camIdx = searchParams.get("camIdx");

        if (!sessionPath || !camIdx) {
            return NextResponse.json({ error: "sessionPath and camIdx are required" }, { status: 400 });
        }

        const colorDir = path.join(sessionPath, "orbbec", `cam${String(parseInt(camIdx, 10)).padStart(2, "0")}`, "color");
        const jpgs = await listJpgsSorted(colorDir);
        const frames = jpgs.map((filename, i) => ({
            t: i,
            filename,
            stem: filename.replace(/\.[^.]+$/, ""),
        }));

        return NextResponse.json({ frames });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
    }
}