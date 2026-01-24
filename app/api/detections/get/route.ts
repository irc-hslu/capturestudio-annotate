import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

function filePath(sessionPath: string, camIdx: number, stem: string) {
    const cam = String(camIdx).padStart(2, "0");
    return path.join(sessionPath, "orbbec", `cam${cam}`, "mask", `detections-${stem}.json`);
}

function roundArray(a: any[]): number[] {
    return a.map((v) => Math.round(Number(v)));
}

function normalizeItem(it: any) {
    const out: any = { ...it };

    // Round base keys if present
    if (Array.isArray(out.bbox)) out.bbox = roundArray(out.bbox);
    if (Array.isArray(out.points)) out.points = out.points.map((p: any) => [Math.round(Number(p[0])), Math.round(Number(p[1]))]);

    // Round rotation-suffixed keys
    const suffixes = ["NONE", "90_CLOCKWISE", "90_COUNTERCLOCKWISE", "180"];
    for (const suf of suffixes) {
        const bk = `bbox_rotated_${suf}`;
        const pk = `points_rotated_${suf}`;
        if (Array.isArray(out[bk])) out[bk] = roundArray(out[bk]);
        if (Array.isArray(out[pk])) {
            out[pk] = out[pk].map((p: any) => [Math.round(Number(p[0])), Math.round(Number(p[1]))]);
        }
    }

    // Ensure labels are ints
    if (Array.isArray(out.point_labels)) out.point_labels = out.point_labels.map((l: any) => Number(l) | 0);
    if (typeof out.frame_idx === "number") out.frame_idx = Math.floor(out.frame_idx);

    return out;
}

export async function GET(req: NextRequest) {
    try {
        const sessionPath = String(req.nextUrl.searchParams.get("sessionPath") || "");
        const camIdx = Number(req.nextUrl.searchParams.get("camIdx") || "NaN");
        const stem = String(req.nextUrl.searchParams.get("stem") || "");

        if (!sessionPath || isNaN(camIdx) || !stem) {
            return NextResponse.json({ error: "sessionPath, camIdx, stem are required" }, { status: 400 });
        }

        const fp = filePath(sessionPath, camIdx, stem);
        let arr: any[] = [];
        try {
            const buf = await fs.readFile(fp, "utf-8");
            arr = JSON.parse(buf);
            if (!Array.isArray(arr)) arr = [];
        } catch {
            arr = [];
            await fs.mkdir(path.dirname(fp), { recursive: true });
            await fs.writeFile(fp, "[]", "utf-8");
        }

        // Normalize/round on readout
        const detections = arr.map(normalizeItem);
        return NextResponse.json({ detections });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
    }
}