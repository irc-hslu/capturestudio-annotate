/**
 * Minimal EXIF orientation helper (placeholder).
 * If you want real EXIF parsing, integrate `exifreader` or similar
 * and map orientation (1..8) to a UI Rotation token.
 */

import type { Rotation } from "@/types/detections";

/** Always returns 1 (no rotation) unless you wire a real EXIF parser. */
export async function readExifOrientation(_jpegBuffer: Buffer): Promise<number> {
    return 1;
}

export function exifToUiRotation(orientation: number): Rotation {
    // Common EXIF orientation mapping to screen-rotation:
    // 1: Normal
    // 3: 180
    // 6: 90 CW
    // 8: 90 CCW
    switch (orientation) {
        case 3:
            return "180";
        case 6:
            return "90_CLOCKWISE";
        case 8:
            return "90_COUNTERCLOCKWISE";
        default:
            return "NONE";
    }
}