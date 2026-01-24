import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    try {
        const sessionPath = req.nextUrl.searchParams.get("sessionPath") || "";
        const camIdxStr = req.nextUrl.searchParams.get("camIdx") || "";
        const stem = req.nextUrl.searchParams.get("stem") || "";

        if (!sessionPath || !camIdxStr || !stem) {
            return NextResponse.json({ error: "sessionPath, camIdx, stem required" }, { status: 400 });
        }

        const cam = String(parseInt(camIdxStr, 10)).padStart(2, "0");
        const file = path.join(sessionPath, "orbbec", `cam${cam}`, "mask", `${stem}.jpg`);

        const buf = await fs.readFile(file);
        return new NextResponse(buf, {
            headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ error: "mask not found" }, { status: 404 });
    }
}