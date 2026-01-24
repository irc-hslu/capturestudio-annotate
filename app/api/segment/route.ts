import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import sharp from "sharp";

export const runtime = "nodejs";

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

async function listJpgsSorted(dir: string) {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.toLowerCase().endsWith(".jpg")).sort((a, b) => a.localeCompare(b));
}

export async function POST(req: NextRequest) {
    try {
        const {
            sessionPath,
            camIdx,
            t,
            rotation = "NONE",
            bboxes,
            points,
            point_labels,
        } = await req.json();

        if (!sessionPath || camIdx == null || t == null) {
            return NextResponse.json({ error: "sessionPath, camIdx, t are required" }, { status: 400 });
        }

        const cam = pad2(parseInt(camIdx, 10));
        const colorDir = path.join(sessionPath, "orbbec", `cam${cam}`, "color");
        const jpgs = await listJpgsSorted(colorDir);
        if (!jpgs.length) return NextResponse.json({ error: "No images" }, { status: 404 });

        const idx = Math.min(Math.max(0, parseInt(t, 10)), Math.max(0, jpgs.length - 1));
        const filename = jpgs[idx];
        const stem = filename.replace(/\.[^.]+$/, "");
        const image_path = path.join(colorDir, filename);

        // Call Python FastAPI /segment
        const pyUrl = "http://127.0.0.1:8060/segment";
        const payload = {
            image_path,
            rotation,
            bboxes: Array.isArray(bboxes) && bboxes.length ? bboxes : undefined,
            points: Array.isArray(points) && points.length ? points : undefined,
            point_labels: Array.isArray(point_labels) && point_labels.length ? point_labels : undefined,
        };

        const pyRes = await fetch(pyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const pyJson = await pyRes.json();

        if (!pyRes.ok) {
            return NextResponse.json({ error: pyJson?.error ?? "Backend error" }, { status: 500 });
        }
        const b64 = pyJson?.mask_png_base64;
        if (!b64) {
            return NextResponse.json({ error: "No mask from backend" }, { status: 200 });
        }

        // Decode PNG base64, re-encode as JPEG, save to mask folder
        const maskDir = path.join(sessionPath, "orbbec", `cam${cam}`, "mask");
        await fs.mkdir(maskDir, { recursive: true });

        const pngBuf = Buffer.from(b64, "base64");
        const jpegBuf = await sharp(pngBuf).jpeg({ quality: 90 }).toBuffer();
        const maskPath = path.join(maskDir, `${stem}.jpg`);
        await fs.writeFile(maskPath, jpegBuf);

        // Return a cache-busted URL that the UI uses to show the overlay
        const maskUrl = `/api/mask/get?sessionPath=${encodeURIComponent(sessionPath)}&camIdx=${camIdx}&stem=${stem}&v=${Date.now()}`;

        return NextResponse.json({
            ok: true,
            width: pyJson?.width ?? null,
            height: pyJson?.height ?? null,
            maskUrl,
            savedPath: maskPath,
        });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
    }
}