import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

/**
 * Returns the raw image bytes (no rotation).
 * The UI is responsible for visually rotating images.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const sessionPath = searchParams.get("sessionPath");
        const camIdx = searchParams.get("camIdx");
        const tStr = searchParams.get("t");

        if (!sessionPath || !camIdx || tStr == null) {
            return NextResponse.json({ error: "sessionPath, camIdx, t are required" }, { status: 400 });
        }

        const cam = String(parseInt(camIdx, 10)).padStart(2, "0");
        const colorDir = path.join(sessionPath, "orbbec", `cam${cam}`, "color");

        const files = (await fs.readdir(colorDir))
            .filter((f) => f.toLowerCase().endsWith(".jpg"))
            .sort((a, b) => a.localeCompare(b));

        if (!files.length) {
            return NextResponse.json({ error: "No images found" }, { status: 404 });
        }

        const t = Math.min(Math.max(0, parseInt(tStr, 10)), Math.max(0, files.length - 1));
        const filePath = path.join(colorDir, files[t]);
        const buf = await fs.readFile(filePath);

        return new NextResponse(buf, {
            status: 200,
            headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "no-store",
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
    }
}