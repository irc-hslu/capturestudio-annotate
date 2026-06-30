import {NextRequest, NextResponse} from "next/server";
import path from "path";
import {promises as fs} from "fs";
import sharp from "sharp";

export const runtime = "nodejs";

type Rotation = "NONE" | "90_CLOCKWISE" | "90_COUNTERCLOCKWISE" | "180";

const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "http://127.0.0.1:8060";

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

async function listJpgsSorted(dir: string) {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.toLowerCase().endsWith(".jpg")).sort((a, b) => a.localeCompare(b));
}

function rotatedKey(base: "bbox" | "points", rotation: Rotation) {
    return rotation === "NONE" ? base : `${base}_rotated_${rotation}`;
}

function frameIdxOf(it: any): number {
    const v = it?.frame_idx;
    return typeof v === "number" ? Math.floor(v) : 0;
}

function asXYXY(v: any): [number, number, number, number] | null {
    if (!Array.isArray(v) || v.length !== 4) return null;
    const a = v.map((x) => Math.round(Number(x)));
    if (a.some((x) => Number.isNaN(x))) return null;
    return [a[0], a[1], a[2], a[3]];
}

function asPoints(v: any): number[][] | null {
    if (!Array.isArray(v)) return null;
    const pts: number[][] = [];
    for (const p of v) {
        if (!Array.isArray(p) || p.length < 2) continue;
        const x = Math.round(Number(p[0]));
        const y = Math.round(Number(p[1]));
        if (Number.isNaN(x) || Number.isNaN(y)) continue;
        pts.push([x, y]);
    }
    return pts.length ? pts : null;
}

export async function POST(req: NextRequest) {
    try {
        const {sessionPath, camIdx, t, rotation = "NONE"} = await req.json();

        if (!sessionPath || camIdx == null || t == null) {
            return NextResponse.json({error: "sessionPath, camIdx, t are required"}, {status: 400});
        }

        const rot = rotation as Rotation;

        const cam = pad2(parseInt(camIdx, 10));
        const colorDir = path.join(sessionPath, "orbbec", `cam${cam}`, "color");
        const jpgs = await listJpgsSorted(colorDir);
        if (!jpgs.length) return NextResponse.json({error: "No images"}, {status: 404});

        const idx = Math.min(Math.max(0, parseInt(String(t), 10)), Math.max(0, jpgs.length - 1));
        const filename = jpgs[idx];
        const stem = filename.replace(/\.[^.]+$/, "");
        const image_path = path.join(colorDir, filename);

        const firstStem = jpgs[0].replace(/\.[^.]+$/, "");
        const detectionsPath = path.join(sessionPath, "orbbec", `cam${cam}`, "mask", `detections-${firstStem}.json`);

        let detArr: any[] = [];
        try {
            const raw = await fs.readFile(detectionsPath, "utf8");
            const js = JSON.parse(raw);
            if (Array.isArray(js)) detArr = js;
        } catch {
            detArr = [];
        }

        const bboxK = rotatedKey("bbox", rot);
        const ptsK = rotatedKey("points", rot);

        const bboxesOut: [number, number, number, number][] = [];
        const pointsOut: number[][] = [];
        const labelsOut: number[] = [];

        for (const it of detArr) {
            if (frameIdxOf(it) !== idx) continue;

            const bb = asXYXY(it?.[bboxK]);
            if (bb) bboxesOut.push(bb);

            const pts = asPoints(it?.[ptsK]);
            if (pts) {
                const lbl = Array.isArray(it?.point_labels) ? it.point_labels.map((x: any) => (Number(x) ? 1 : 0)) : [];
                for (let i = 0; i < pts.length; i++) {
                    pointsOut.push(pts[i]);
                    labelsOut.push(lbl[i] ?? 1);
                }
            }
        }

        const pyRes = await fetch(`${BACKEND_URL}/segment`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                image_path,
                rotation: rot,
                bboxes: bboxesOut.length ? bboxesOut : undefined,
                points: pointsOut.length ? pointsOut : undefined,
                point_labels: labelsOut.length ? labelsOut : undefined,
            }),
        });
        const pyJson = await pyRes.json();

        if (!pyRes.ok) {
            return NextResponse.json({error: pyJson?.error ?? "Backend error"}, {status: 500});
        }
        const b64 = pyJson?.mask_png_base64;
        if (!b64) {
            return NextResponse.json({error: "No mask from backend"}, {status: 200});
        }

        const maskDir = path.join(sessionPath, "orbbec", `cam${cam}`, "mask");
        await fs.mkdir(maskDir, {recursive: true});

        const pngBuf = Buffer.from(b64, "base64");
        const jpegBuf = await sharp(pngBuf).jpeg({quality: 90}).toBuffer();
        const maskPath = path.join(maskDir, `${stem}.jpg`);
        await fs.writeFile(maskPath, jpegBuf);

        const maskUrl = `/api/mask/get?sessionPath=${encodeURIComponent(sessionPath)}&camIdx=${camIdx}&stem=${stem}&v=${Date.now()}`;

        return NextResponse.json({
            ok: true,
            width: pyJson?.width ?? null,
            height: pyJson?.height ?? null,
            maskUrl,
            savedPath: maskPath,
        });
    } catch (e: any) {
        return NextResponse.json({error: String(e?.message ?? e)}, {status: 500});
    }
}