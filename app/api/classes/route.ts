import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

async function loadClasses(p: string) {
    try {
        const raw = await fs.readFile(p, "utf-8");
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

async function saveClasses(p: string, arr: any[]) {
    await fs.writeFile(p, JSON.stringify(arr, null, 2), "utf-8");
}

function randomColor() {
    const c = Math.floor(Math.random() * 0xffffff);
    return `#${c.toString(16).padStart(6, "0")}`;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const sessionPath = searchParams.get("sessionPath");
        if (!sessionPath) return NextResponse.json({ error: "sessionPath is required" }, { status: 400 });

        const file = path.join(sessionPath, ".annotator_classes.json");
        const classes = await loadClasses(file);
        return NextResponse.json({ classes });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { sessionPath, name, color } = await req.json();
        if (!sessionPath || !name) return NextResponse.json({ error: "sessionPath and name are required" }, { status: 400 });

        const file = path.join(sessionPath, ".annotator_classes.json");
        const arr = await loadClasses(file);

        const idx = arr.findIndex((c: any) => c.name === name);
        if (idx >= 0) {
            // update color if provided
            if (color) arr[idx].color = color;
        } else {
            arr.push({ name, color: color ?? randomColor() });
        }

        await saveClasses(file, arr);
        return NextResponse.json({ classes: arr });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
    }
}