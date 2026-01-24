import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

function detectionsPath(sessionPath: string, camIdx: number, stem: string) {
    const cam = String(camIdx).padStart(2, "0");
    return path.join(sessionPath, "orbbec", `cam${cam}`, "mask", `detections-${stem}.json`);
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const body = await req.json();
    const sessionPath: string = body?.sessionPath;
    const camIdx: number = Number(body?.camIdx);
    const stem: string = body?.stem;
    const index: number = Number(body?.index);

    if (!sessionPath || isNaN(camIdx) || !stem || isNaN(index)) {
        return NextResponse.json(
            { error: "sessionPath, camIdx, stem, index are required" },
            { status: 400 }
        );
    }

    const fp = detectionsPath(sessionPath, camIdx, stem);

    let arr: any[] = [];
    try {
        const buf = await fs.readFile(fp, "utf-8");
        arr = JSON.parse(buf);
        if (!Array.isArray(arr)) arr = [];
    } catch {
        arr = [];
    }

    if (index >= 0 && index < arr.length) {
        arr.splice(index, 1);
    }

    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, JSON.stringify(arr, null, 2), "utf-8");
    return NextResponse.json({ detections: arr });
}