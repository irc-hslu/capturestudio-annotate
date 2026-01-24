import path from "path";
import { promises as fs } from "fs";

/**
 * Write file atomically:
 *  - write to temp file in same dir
 *  - fsync temp
 *  - rename over target
 *  - fsync directory
 */
export async function writeFileAtomic(targetPath: string, data: string | Buffer) {
    const dir = path.dirname(targetPath);
    const base = path.basename(targetPath);
    const tmp = path.join(dir, `.${base}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const fh = await fs.open(tmp, "w");
    try {
        if (typeof data === "string") {
            await fh.writeFile(data, "utf8");
        } else {
            await fh.writeFile(data);
        }
        await fh.sync();
    } finally {
        await fh.close();
    }
    await fs.rename(tmp, targetPath);

    // fsync the directory to persist rename on some filesystems
    try {
        const dh = await fs.opendir(dir);
        try {
            // @ts-ignore Node types skip sync on Dir handle
            if (typeof (dh as any).sync === "function") await (dh as any).sync();
        } finally {
            await dh.close();
        }
    } catch {
        // best effort
    }
}