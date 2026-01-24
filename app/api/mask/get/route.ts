import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const sessionPath = searchParams.get("sessionPath");
        const camIdx = searchParams.get("camIdx");
        const stem = searchParams.get("stem");

        if (!sessionPath || !camIdx || !stem) {
            return NextResponse.json({ error: "sessionPath, camIdx, stem required" }, { status: 400 });
        }

        const cam = pad2(parseInt(camIdx, 10));
        const maskPath = path.join(sessionPath, "orbbec", `cam${cam}`, "mask", `${stem}.jpg`);
        const data = await fs.readFile(maskPath);
        return new NextResponse(data, {
            status: 200,
            headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "no-store",
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: "Mask not found" }, { status: 404 });
    }
}