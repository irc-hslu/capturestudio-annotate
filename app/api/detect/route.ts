import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';

const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    'http://127.0.0.1:8060';

export async function POST(req: NextRequest) {
    const { sessionPath, camIdx, t = 0, rotation = 'NONE', minConfidence = 0.7, classNames } =
        await req.json();

    if (!sessionPath || camIdx == null) {
        return NextResponse.json(
            { error: 'sessionPath and camIdx are required' },
            { status: 400 }
        );
    }

    const cam = String(parseInt(camIdx, 10)).padStart(2, '0');
    const colorDir = path.join(sessionPath, 'orbbec', `cam${cam}`, 'color');
    const files = (await fs.readdir(colorDir))
        .filter((f) => f.toLowerCase().endsWith('.jpg'))
        .sort((a, b) => a.localeCompare(b));

    if (!files.length) {
        return NextResponse.json({ width: 0, height: 0, detections: [] });
    }

    const idx = Math.min(Math.max(0, parseInt(String(t), 10)), files.length - 1);
    const imgPath = path.join(colorDir, files[idx]);

    const resp = await fetch(`${BACKEND_URL}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image_path: imgPath,
            rotation,
            min_confidence: Number(minConfidence),
            class_names: Array.isArray(classNames) ? classNames : undefined,
        }),
    });

    const data = await resp.json();
    if (!resp.ok) {
        return NextResponse.json({ error: data?.detail ?? data?.error ?? 'Detect failed' }, { status: 500 });
    }
    return NextResponse.json(data);
}