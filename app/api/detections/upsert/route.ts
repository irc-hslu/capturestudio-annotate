import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

type Rotation = "NONE" | "90_CLOCKWISE" | "90_COUNTERCLOCKWISE" | "180";

function detectionsPath(sessionPath: string, camIdx: number, stem: string) {
    const cam = String(camIdx).padStart(2, "0");
    return path.join(sessionPath, "orbbec", `cam${cam}`, "mask", `detections-${stem}.json`);
}

async function ensureDirForFile(fp: string) {
    await fs.mkdir(path.dirname(fp), { recursive: true });
}

function rotatedKey(base: "bbox" | "points", rotation: Rotation) {
    return rotation === "NONE" ? base : `${base}_rotated_${rotation}`;
}

function roundXYXY(xyxy: number[]) {
    return xyxy.map((v) => Math.round(Number(v)));
}
function roundPoints(pts: number[][]) {
    return pts.map((p) => [Math.round(Number(p[0])), Math.round(Number(p[1]))]);
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const body = await req.json();

    const sessionPath: string = body?.sessionPath;
    const camIdx: number = Number(body?.camIdx);
    const stem: string = body?.stem;
    const index: number | null = body?.index ?? null;
    const rotation: Rotation = (body?.rotation ?? "NONE") as Rotation;
    const frameIdx: number | undefined = body?.frameIdx;
    const item: any = body?.item;

    if (!sessionPath || isNaN(camIdx) || !stem || !item) {
        return NextResponse.json(
            { error: "sessionPath, camIdx, stem and item are required" },
            { status: 400 }
        );
    }
    if (!item.class_name) {
        return NextResponse.json({ error: "item.class_name is required" }, { status: 400 });
    }

    const fp = detectionsPath(sessionPath, camIdx, stem);
    await ensureDirForFile(fp);

    let arr: any[] = [];
    try {
        const buf = await fs.readFile(fp, "utf-8");
        arr = JSON.parse(buf);
        if (!Array.isArray(arr)) arr = [];
    } catch {
        arr = [];
    }

    // Normalize rotation-suffixed keys and round to ints
    const out: any = {
        confidence: item.confidence ?? 1.0,
        class_name: item.class_name,
        class_id: item.class_id ?? 0,
    };

    if (typeof frameIdx === "number") out.frame_idx = Math.floor(frameIdx);

    if (item.bbox && Array.isArray(item.bbox)) {
        out[rotatedKey("bbox", rotation)] = roundXYXY(item.bbox);
    }
    if (item.points && Array.isArray(item.points)) {
        out[rotatedKey("points", rotation)] = roundPoints(item.points);
        if (Array.isArray(item.point_labels)) {
            out.point_labels = item.point_labels.map((l: any) => Number(l) | 0);
        }
    }

    if (index == null || index < 0 || index >= arr.length) {
        arr.push(out);
    } else {
        // merge into existing (preserve other rotations)
        arr[index] = { ...arr[index], ...out };
    }

    await fs.writeFile(fp, JSON.stringify(arr, null, 2), "utf-8");
    return NextResponse.json({ detections: arr });
}