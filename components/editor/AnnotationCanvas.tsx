"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Group, Circle, Image as KImage, Transformer } from "react-konva";
import useImage from "use-image";
import type { DetectionItem, Rotation } from "@/types/detections";
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
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ w: 100, h: 100 });

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

    const fit = useMemo(() => {
        const cw = containerSize.w,
            ch = containerSize.h;
        const iw = natural.w,
            ih = natural.h;
        const s = Math.min(cw / iw, ch / ih);
        const dw = iw * s,
            dh = ih * s;
        const ox = (cw - dw) / 2,
            oy = (ch - dh) / 2;
        return { scale: s, offsetX: ox, offsetY: oy, drawW: dw, drawH: dh };
    }, [containerSize, natural]);

    function toImgCoord(px: number, py: number) {
        return { x: (px - fit.offsetX) / fit.scale, y: (py - fit.offsetY) / fit.scale };
    }
    function toScreenCoord(ix: number, iy: number) {
        return { x: ix * fit.scale + fit.offsetX, y: iy * fit.scale + fit.offsetY };
    }

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

        const button = e.evt?.button; // 0=left, 2=right (Konva passes native)
        // prevent native context menu always, so it never steals focus
        if (button === 2) {
            e.evt.preventDefault();
        }

        if (tool === "points" && !hideAnnotations) {
            const { x, y } = toImgCoord(pos.x, pos.y);
            if (button === 2) {
                // right click -> negative
                onCreatePoint({ x: Math.round(x), y: Math.round(y), label: 0 });
            } else if (button === 0) {
                // left click -> positive
                onCreatePoint({ x: Math.round(x), y: Math.round(y), label: 1 });
            }
            return;
        }

        if (tool === "bbox" && !hideAnnotations) {
            // only start drag with left button
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
        let x1 = Math.min(dragStart.x, dragEnd.x);
        let y1 = Math.min(dragStart.y, dragEnd.y);
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

    const classesColors: Record<number, string> = useMemo(() => {
        const palette = ["#ff3838", "#ff9f38", "#ffff38", "#38ff38", "#38ffff", "#3838ff", "#9f38ff", "#ff389f"];
        const map: Record<number, string> = {};
        detections.forEach((d) => {
            if (typeof d.class_id === "number") map[d.class_id] = palette[d.class_id % palette.length];
        });
        return map;
    }, [detections]);

    return (
        <div ref={containerRef} className="w-full h-full">
            <Stage
                width={containerSize.w}
                height={containerSize.h}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                // block native context menu so right-click never triggers the browser menu
                onContextMenu={(e) => {
                    e.evt?.preventDefault?.();
                }}
            >
                <Layer listening={!disabledInteractions}>
                    {img && (
                        <KImage image={img} x={fit.offsetX} y={fit.offsetY} width={fit.drawW} height={fit.drawH} listening={false} />
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
                                        stroke={classesColors[d.class_id ?? 0] ?? "#00f"}
                                        strokeWidth={isSelected ? 3 : 2}
                                        listening={!disabledInteractions && tool === "select"}
                                        draggable={!disabledInteractions && tool === "select"}
                                        onClick={() => setSelectedIndex(i)}
                                        onTap={() => setSelectedIndex(i)}
                                        onDragEnd={(e) => {
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