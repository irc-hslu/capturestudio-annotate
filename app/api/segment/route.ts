import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import sharp from "sharp";

export const runtime = "nodejs";

// Small helper: pick image path by index `t` for camXX/color/*.jpg (sorted)
async function getImagePath(sessionPath: string, camIdx: number, t: number): Promise<{ imgPath: string; stem: string }> {
    const cam = String(parseInt(String(camIdx), 10)).padStart(2, "0");
    const colorDir = path.join(sessionPath, "orbbec", `cam${cam}`, "color");
    const files = (await fs.readdir(colorDir))
        .filter((f) => f.toLowerCase().endsWith(".jpg"))
        .sort((a, b) => a.localeCompare(b));
    if (!files.length) throw new Error("No color frames");
    const idx = Math.min(Math.max(0, t | 0), files.length - 1);
    const filename = files[idx];
    const stem = filename.replace(/\.[^.]+$/, "");
    return { imgPath: path.join(colorDir, filename), stem };
}

export async function POST(req: NextRequest) {
    try {
        const {
            sessionPath,
            camIdx,
            t,
            rotation = "NONE",
            bboxes = [],
            points = [],
            point_labels = [],
            stem: stemFromClient,
        } = await req.json();

        if (!sessionPath || camIdx == null || t == null) {
            return NextResponse.json({ error: "sessionPath, camIdx, t are required" }, { status: 400 });
        }

        // Resolve image path + stem (prefer computed stem for safety)
        const { imgPath, stem } = await getImagePath(sessionPath, Number(camIdx), Number(t));
        const saveStem = stemFromClient && typeof stemFromClient === "string" ? stemFromClient : stem;

        // Call FastAPI /segment
        const resp = await fetch("http://127.0.0.1:8060/segment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                image_path: imgPath,
                rotation,
                bboxes,       // List[[x1,y1,x2,y2], ...] in rotated frame (UI matches server rotation)
                points,       // Optional [[x,y], ...]
                point_labels, // Optional [0|1, ...]
            }),
        });

        const data = await resp.json();
        if (!resp.ok || !data?.mask_png_base64) {
            return NextResponse.json({ error: "Segmentation failed" }, { status: 500 });
        }

        // Decode base64 PNG to Buffer
        const b64 = String(data.mask_png_base64);
        const raw = Buffer.from(b64, "base64");

        // Ensure mask dir
        const cam = String(parseInt(String(camIdx), 10)).padStart(2, "0");
        const maskDir = path.join(sessionPath, "orbbec", `cam${cam}`, "mask");
        await fs.mkdir(maskDir, { recursive: true });

        // Save as JPG: <color_stem>.jpg
        const jpgPath = path.join(maskDir, `${saveStem}.jpg`);
        const jpg = await sharp(raw).jpeg({ quality: 92 }).toBuffer();
        await fs.writeFile(jpgPath, jpg);

        // Return URL to fetch mask
        const maskUrl = `/api/mask/get?sessionPath=${encodeURIComponent(sessionPath)}&camIdx=${camIdx}&stem=${encodeURIComponent(
            saveStem
        )}&v=${Date.now()}`;

        return NextResponse.json({
            width: data.width,
            height: data.height,
            saved: true,
            maskUrl,
        });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
    }
}