"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Pink-background overlay using a binary mask:
 * - Areas where mask == 0 -> strongly pink.
 * - Areas where mask == 1 -> original image shows through (no pink).
 *
 * Implementation notes:
 * - We draw into a canvas absolutely positioned over the editor.
 * - We compute the same "fit" (scale+letterbox) as the image so the mask aligns perfectly.
 * - We convert the mask's luminance into an alpha mask to punch out the pink in foreground areas.
 */
export function MaskOverlay({
                                containerRef,
                                imageUrl,
                                maskUrl,
                                show,
                                pinkAlpha = 0.8, // strong pink mix
                            }: {
    containerRef: React.RefObject<HTMLDivElement>;
    imageUrl: string | null;
    maskUrl: string | null;
    show: boolean;
    pinkAlpha?: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Track container size (Stage size)
    const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => {
            const r = el.getBoundingClientRect();
            setContainerSize({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [containerRef]);

    // Load natural image size (we align the mask to the image’s fit, not to the canvas size)
    const [natural, setNatural] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
    useEffect(() => {
        if (!imageUrl) {
            setNatural({ w: 0, h: 0 });
            return;
        }
        const img = new Image();
        img.onload = () => setNatural({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
        img.src = imageUrl;
    }, [imageUrl]);

    // Load mask image (as HTMLImageElement). We’ll re-sample and convert its luminance to alpha.
    const [maskImg, setMaskImg] = useState<HTMLImageElement | null>(null);
    useEffect(() => {
        if (!maskUrl) {
            setMaskImg(null);
            return;
        }
        const img = new Image();
        // Important to avoid tainting if served from same origin; otherwise, ensure CORS.
        img.crossOrigin = "anonymous";
        img.onload = () => setMaskImg(img as HTMLImageElement);
        img.src = maskUrl;
    }, [maskUrl]);

    // Same fit calc used by the canvas editor (contain + center)
    const fit = useMemo(() => {
        const cw = containerSize.w, ch = containerSize.h;
        const iw = natural.w, ih = natural.h;
        if (!cw || !ch || !iw || !ih) {
            return { scale: 1, offsetX: 0, offsetY: 0, drawW: 0, drawH: 0 };
        }
        const s = Math.min(cw / iw, ch / ih);
        const dw = iw * s;
        const dh = ih * s;
        const ox = (cw - dw) / 2;
        const oy = (ch - dh) / 2;
        return { scale: s, offsetX: ox, offsetY: oy, drawW: dw, drawH: dh };
    }, [containerSize, natural]);

    // Draw overlay whenever deps change
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Size canvas to container
        canvas.width = Math.max(1, Math.floor(containerSize.w));
        canvas.height = Math.max(1, Math.floor(containerSize.h));

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clear first
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!show || !maskImg || fit.drawW <= 0 || fit.drawH <= 0) {
            // Nothing to draw
            return;
        }

        // 1) Fill pink where the image is drawn
        ctx.save();
        ctx.globalAlpha = pinkAlpha;
        ctx.fillStyle = "rgb(255,105,180)"; // strong pink
        ctx.fillRect(fit.offsetX, fit.offsetY, fit.drawW, fit.drawH);
        ctx.restore();

        // 2) Build an alpha mask from the mask image’s luminance to punch out pink over foreground
        //    (destination-out removes the pink where the mask is foreground).
        const off = document.createElement("canvas");
        off.width = Math.max(1, Math.floor(fit.drawW));
        off.height = Math.max(1, Math.floor(fit.drawH));
        const ox = off.getContext("2d")!;
        // Draw mask scaled to the draw rect
        ox.drawImage(maskImg, 0, 0, off.width, off.height);

        const imgData = ox.getImageData(0, 0, off.width, off.height);
        const data = imgData.data;
        // Convert luminance to alpha: assume white (255) => FG => alpha=255; black (0)=>BG=>alpha=0
        // Set RGB to opaque white; alpha from luminance (use R channel sufficient for gray mask)
        for (let i = 0; i < data.length; i += 4) {
            const l = data[i]; // red channel
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = l; // alpha
        }
        ox.putImageData(imgData, 0, 0);

        // 3) Punch the pink out where mask==1 (white)
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(off, fit.offsetX, fit.offsetY);
        ctx.restore();
    }, [show, maskImg, containerSize, fit, pinkAlpha]);

    if (!show || !maskUrl) return null;

    return (
        <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
        />
    );
}