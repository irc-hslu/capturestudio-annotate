import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CamSummary = {
    idx: number;
    colorDir: string;
    firstFilename: string | null;
    firstStem: string | null;
    numFrames: number;
    detectionsFile: string | null;
};

async function listSortedJpgs(dir: string): Promise<string[]> {
    const files = await fs.readdir(dir);
    return files
        .filter((f) => f.toLowerCase().endsWith(".jpg"))
        .sort((a, b) => a.localeCompare(b));
}

export async function POST(req: NextRequest) {
    console.log("[/api/session] POST");
    const body = await req.json();
    const sessionPath: string | undefined = body?.sessionPath;

    if (!sessionPath || typeof sessionPath !== "string") {
        return NextResponse.json({ error: "sessionPath is required" }, { status: 400 });
    }

    const orbbecDir = path.join(sessionPath, "orbbec");

    const entries = await fs.readdir(orbbecDir, { withFileTypes: true });
    const camDirs = entries
        .filter((d) => d.isDirectory() && /^cam\d{2}$/.test(d.name))
        .map((d) => d.name)
        .sort();

    const cams: CamSummary[] = [];
    for (const camName of camDirs) {
        const colorDir = path.join(orbbecDir, camName, "color");
        let jpgs: string[] = [];
        try {
            jpgs = await listSortedJpgs(colorDir);
        } catch {
            jpgs = [];
        }

        const firstFilename = jpgs.length ? jpgs[0] : null;
        const firstStem = firstFilename ? firstFilename.replace(/\.[^.]+$/, "") : null;
        const detectionsFile =
            firstStem != null
                ? path.join(orbbecDir, camName, "mask", `detections-${firstStem}.json`)
                : null;

        cams.push({
            idx: parseInt(camName.replace("cam", ""), 10),
            colorDir,
            firstFilename,
            firstStem,
            numFrames: jpgs.length,
            detectionsFile,
        });
    }

    // Minimal payload: only per-camera summary; clients can later query /api/frames for lists.
    return NextResponse.json(
        { cams },
        { headers: { "Cache-Control": "no-store" } }
    );
}