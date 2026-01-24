"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Group, Circle, Image as KImage, Transformer } from "react-konva";
import useImage from "use-image";
import type { DetectionItem, Rotation } from "@/types/detections";
import { useClasses } from "@/store/useClasses";
import { useEditor } from "@/store/useEditor";

export function AnnotationCanvas({
                                     imageUrl,
                                     loading,
                                     rotation, // kept in signature, not changing existing behavior here
                                     detections,
                                     editIndex,
                                     onEditIndexCleared,
                                     onCreateBBox,
                                     onCreatePoint,
                                     onUpdateBBox,
                                     hideAnnotations,
                                     disabledInteractions,
                                 }: {
    imageUrl: string | null;
    loading: boolean;
    rotation: Rotation;
    detections: DetectionItem[];
    editIndex: number | null;
    onEditIndexCleared: () => void;
    onCreateBBox: (xyxy: [number, number, number, number]) => void;
    onCreatePoint: (opts: { x: number; y: number; label: 0 | 1 }) => void;
    onUpdateBBox: (index: number, xyxy: [number, number, number, number]) => void;
    hideAnnotations?: boolean;
    disabledInteractions?: boolean;
}) {
    const { tool } = useEditor();
    const { classes } = useClasses();
    const classColorById = useMemo(() => {
        const m: Record<number, string> = {};
        for (const c of classes) m[c.id] = c.color;
        return m;
    }, [classes]);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ w: 100, h: 100 });

    // --- NEW: rotation helpers (minimal) ---------------------------------------
    const rotAngle = (r: Rotation) =>
        r === "90_CLOCKWISE" ? 90 : r === "90_COUNTERCLOCKWISE" ? -90 : r === "180" ? 180 : 0;

    const rotatedDims = (w: number, h: number, r: Rotation) =>
        r === "90_CLOCKWISE" || r === "90_COUNTERCLOCKWISE" ? { W: h, H: w } : { W: w, H: h };

    function ptToView([x, y]: [number, number], W: number, H: number, r: Rotation): [number, number] {
        switch (r) {
            case "NONE":
                return [x, y];
            case "90_CLOCKWISE":
                return [H - 1 - y, x];
            case "90_COUNTERCLOCKWISE":
                return [y, W - 1 - x];
            case "180":
                return [W - 1 - x, H - 1 - y];
        }
    }

    function ptToBase([x, y]: [number, number], W: number, H: number, r: Rotation): [number, number] {
        switch (r) {
            case "NONE":
                return [x, y];
            case "90_CLOCKWISE":
                return [y, H - 1 - x];
            case "90_COUNTERCLOCKWISE":
                return [W - 1 - y, x];
            case "180":
                return [W - 1 - x, H - 1 - y];
        }
    }
    // ---------------------------------------------------------------------------

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => {
            const rect = el.getBoundingClientRect();
            setContainerSize({ w: Math.max(50, rect.width), h: Math.max(50, rect.height) });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const [img] = useImage(imageUrl ?? "", "anonymous");
    const natural = useMemo(() => ({ w: img?.width ?? 1, h: img?.height ?? 1 }), [img]);

    // --- CHANGED: fit now uses rotated view dimensions -------------------------
    const { W: viewW, H: viewH } = useMemo(
        () => rotatedDims(natural.w, natural.h, rotation),
        [natural, rotation]
    );

    const fit = useMemo(() => {
        const cw = containerSize.w,
            ch = containerSize.h;
        const s = Math.min(cw / viewW, ch / viewH);
        const dw = viewW * s,
            dh = viewH * s;
        const ox = (cw - dw) / 2,
            oy = (ch - dh) / 2;
        return { scale: s, offsetX: ox, offsetY: oy, drawW: dw, drawH: dh };
    }, [containerSize, viewW, viewH]);
    // ---------------------------------------------------------------------------

    // --- CHANGED: coords convert via rotated "view" frame ----------------------
    function toImgCoord(px: number, py: number) {
        // screen -> view
        const vx = (px - fit.offsetX) / fit.scale;
        const vy = (py - fit.offsetY) / fit.scale;
        // view -> base
        const [bx, by] = ptToBase([vx, vy], natural.w, natural.h, rotation);
        return { x: bx, y: by };
    }

    function toScreenCoord(ix: number, iy: number) {
        // base -> view
        const [vx, vy] = ptToView([ix, iy], natural.w, natural.h, rotation);
        // view -> screen
        return { x: vx * fit.scale + fit.offsetX, y: vy * fit.scale + fit.offsetY };
    }
    // ---------------------------------------------------------------------------

    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);

    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const shapeRefs = useRef<Array<any>>([]);
    const trRef = useRef<any>(null);

    useEffect(() => {
        if (typeof editIndex === "number") setSelectedIndex(editIndex);
    }, [editIndex]);

    useEffect(() => {
        const tr = trRef.current;
        if (tr && selectedIndex != null && shapeRefs.current[selectedIndex]) {
            tr.nodes([shapeRefs.current[selectedIndex]]);
            tr.getLayer()?.batchDraw();
        } else if (tr) {
            tr.nodes([]);
            tr.getLayer()?.batchDraw();
        }
    }, [selectedIndex, detections]);

    function onMouseDown(e: any) {
        if (disabledInteractions) return;
        const stage = e.target.getStage();
        const pos = stage?.getPointerPosition();
        if (!pos) return;

        const button = e.evt?.button; // 0=left, 2=right
        if (button === 2) {
            e.evt.preventDefault();
        }

        if (tool === "points" && !hideAnnotations) {
            const { x, y } = toImgCoord(pos.x, pos.y);
            if (button === 2) {
                onCreatePoint({ x: Math.round(x), y: Math.round(y), label: 0 });
            } else if (button === 0) {
                onCreatePoint({ x: Math.round(x), y: Math.round(y), label: 1 });
            }
            return;
        }

        if (tool === "bbox" && !hideAnnotations) {
            if (button !== 0) return;
            const { x, y } = toImgCoord(pos.x, pos.y);
            setDragStart({ x, y });
            setDragEnd({ x, y });
            setSelectedIndex(null);
            onEditIndexCleared();
            return;
        }

        if (tool === "select" && !hideAnnotations) {
            if (e.target === stage) {
                setSelectedIndex(null);
                onEditIndexCleared();
            }
            return;
        }
    }

    function onMouseMove(e: any) {
        if (disabledInteractions) return;
        if (tool !== "bbox" || hideAnnotations) return;
        if (!dragStart) return;
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;
        const { x, y } = toImgCoord(pos.x, pos.y);
        setDragEnd({ x, y });
    }

    function onMouseUp(_e: any) {
        if (disabledInteractions) return;
        if (tool !== "bbox" || hideAnnotations) return;
        if (!dragStart || !dragEnd) {
            setDragStart(null);
            setDragEnd(null);
            return;
        }
        let x1 = Math.min(dragStart.x, dragEnd.y === undefined ? dragStart.y : dragEnd.x);
        let y1 = Math.min(dragStart.y, dragEnd.y === undefined ? dragStart.y : dragEnd.y);
        let x2 = Math.max(dragStart.x, dragEnd.x);
        let y2 = Math.max(dragStart.y, dragEnd.y);
        x1 = Math.round(x1);
        y1 = Math.round(y1);
        x2 = Math.round(x2);
        y2 = Math.round(y2);
        if (x2 > x1 && y2 > y1) onCreateBBox([x1, y1, x2, y2]);
        setDragStart(null);
        setDragEnd(null);
    }

    return (
        <div ref={containerRef} className="w-full h-full">
            <Stage
                width={containerSize.w}
                height={containerSize.h}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onContextMenu={(e) => {
                    e.evt?.preventDefault?.();
                }}
            >
                <Layer listening={!disabledInteractions}>
                    {img && (
                        // CHANGED: draw rotated image, scaled to fit the rotated rectangle
                        <KImage
                            image={img}
                            // place at center of the draw rect
                            x={fit.offsetX + fit.drawW / 2}
                            y={fit.offsetY + fit.drawH / 2}
                            offsetX={natural.w / 2}
                            offsetY={natural.h / 2}
                            rotation={rotAngle(rotation)}
                            // scale so its axis-aligned box equals drawW x drawH
                            scaleX={
                                rotAngle(rotation) === 0 || rotAngle(rotation) === 180
                                    ? fit.drawW / natural.w
                                    : fit.drawW / natural.h
                            }
                            scaleY={
                                rotAngle(rotation) === 0 || rotAngle(rotation) === 180
                                    ? fit.drawH / natural.h
                                    : fit.drawH / natural.w
                            }
                            listening={false}
                        />
                    )}

                    {!hideAnnotations &&
                        detections.map((d, i) => {
                            if (!d.bbox) return null;
                            const [x1, y1, x2, y2] = d.bbox as [number, number, number, number];
                            const p1 = toScreenCoord(x1, y1);
                            const p2 = toScreenCoord(x2, y2);
                            const w = Math.max(1, p2.x - p1.x);
                            const h = Math.max(1, p2.y - p1.y);
                            const isSelected = selectedIndex === i;

                            return (
                                <Group key={i}>
                                    <Rect
                                        ref={(node) => (shapeRefs.current[i] = node)}
                                        x={p1.x}
                                        y={p1.y}
                                        width={w}
                                        height={h}
                                        stroke={classColorById[d.class_id ?? 0] ?? "#00f"}
                                        strokeWidth={isSelected ? 3 : 2}
                                        listening={!disabledInteractions && tool === "select"}
                                        draggable={!disabledInteractions && tool === "select"}
                                        onClick={() => setSelectedIndex(i)}
                                        onTap={() => setSelectedIndex(i)}
                                        onDragEnd={(e) => {
                                            // node coords are in screen space; convert back to base image coords
                                            const tl = toImgCoord(e.target.x(), e.target.y());
                                            const br = toImgCoord(e.target.x() + e.target.width(), e.target.y() + e.target.height());
                                            onUpdateBBox(i, [Math.round(tl.x), Math.round(tl.y), Math.round(br.x), Math.round(br.y)]);
                                        }}
                                        onTransformEnd={() => {
                                            const node = shapeRefs.current[i];
                                            const scaleX = node.scaleX();
                                            const scaleY = node.scaleY();
                                            node.scaleX(1);
                                            node.scaleY(1);
                                            const nx = node.x();
                                            const ny = node.y();
                                            const nw = Math.max(1, node.width() * scaleX);
                                            const nh = Math.max(1, node.height() * scaleY);
                                            const tl = toImgCoord(nx, ny);
                                            const br = toImgCoord(nx + nw, ny + nh);
                                            onUpdateBBox(i, [Math.round(tl.x), Math.round(tl.y), Math.round(br.x), Math.round(br.y)]);
                                        }}
                                    />
                                </Group>
                            );
                        })}

                    {selectedIndex != null && !hideAnnotations && tool === "select" && (
                        <Transformer
                            ref={trRef}
                            rotateEnabled={false}
                            enabledAnchors={[
                                "top-left",
                                "top-right",
                                "bottom-left",
                                "bottom-right",
                                "top-center",
                                "bottom-center",
                                "middle-left",
                                "middle-right",
                            ]}
                            anchorSize={8}
                            borderDash={[4, 4]}
                        />
                    )}

                    {!hideAnnotations &&
                        detections.map((d, i) => {
                            const pts = (d as any).points as number[][] | undefined;
                            const lbl = d.point_labels as number[] | undefined;
                            if (!pts || !pts.length) return null;
                            return pts.map((p, j) => {
                                const pos = toScreenCoord(p[0], p[1]);
                                const isPositive = (lbl?.[j] ?? 1) ? true : false;
                                return (
                                    <Circle
                                        key={`${i}-${j}`}
                                        x={pos.x}
                                        y={pos.y}
                                        radius={6}
                                        fill={isPositive ? "#22c55e" : "#ef4444"}
                                        stroke="#000"
                                        strokeWidth={1}
                                        listening={false}
                                    />
                                );
                            });
                        })}

                    {tool === "bbox" && !hideAnnotations && dragStart && dragEnd && (
                        <Rect
                            x={toScreenCoord(Math.min(dragStart.x, dragEnd.x), Math.min(dragStart.y, dragEnd.y)).x}
                            y={toScreenCoord(Math.min(dragStart.x, dragEnd.x), Math.min(dragStart.y, dragEnd.y)).y}
                            width={Math.abs((dragEnd.x - dragStart.x) * fit.scale)}
                            height={Math.abs((dragEnd.y - dragStart.y) * fit.scale)}
                            stroke="#fff"
                            strokeWidth={2}
                            dash={[6, 4]}
                            listening={false}
                        />
                    )}
                </Layer>
            </Stage>
        </div>
    );
}