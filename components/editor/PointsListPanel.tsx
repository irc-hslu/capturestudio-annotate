"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { DetectionItem } from "@/types/detections";
import { Trash2 } from "lucide-react";

export function PointsListPanel({
                                    items,
                                    onDelete,
                                    onAppendPoint,
                                    onUpdatePoint,
                                    onRemovePoint,
                                    disabled,
                                }: {
    items: DetectionItem[];
    onDelete: (index: number) => void; // delete whole group
    onAppendPoint: (index: number, pt: [number, number], label: 0 | 1) => void;
    onUpdatePoint: (index: number, pIdx: number, pt: [number, number], label: 0 | 1) => void;
    onRemovePoint: (index: number, pIdx: number) => void; // delete a single point
    disabled?: boolean;
}) {
    return (
        <div className="flex flex-col min-h-0">
            <ScrollArea className="flex-1 min-h-0 pr-2">
                <div className="flex flex-col gap-3">
                    {items.map((it, idx) => {
                        const pts = (it as any).points as number[][] | undefined;
                        const lbl = it.point_labels as number[] | undefined;
                        if (!pts || !pts.length) return null;

                        return (
                            <div key={idx} className="relative border rounded-md p-2">
                                {/* group delete icon top-right */}
                                <div className="absolute top-1 right-1">
                                    <button
                                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-accent disabled:opacity-50"
                                        title="Delete group"
                                        disabled={disabled}
                                        onClick={() => onDelete(idx)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="text-[11px] font-medium mb-2 pr-10">Points</div>

                                {/* list of points; each row is inline */}
                                <div className="flex flex-col gap-2">
                                    {pts.map((p, pIdx) => {
                                        const [x, y] = p.map((v) => Math.round(Number(v))) as [number, number];
                                        const label = (lbl?.[pIdx] ?? 1) ? 1 : 0;

                                        return (
                                            <div
                                                key={pIdx}
                                                className="flex items-center gap-2 flex-wrap"
                                            >
                                                <label className="text-[11px] text-muted-foreground">x</label>
                                                <input
                                                    className="border rounded px-1 py-1 bg-background text-xs w-16"
                                                    type="number"
                                                    value={x}
                                                    disabled={disabled}
                                                    onChange={(e) =>
                                                        onUpdatePoint(idx, pIdx, [Math.round(Number(e.target.value) || 0), y], label)
                                                    }
                                                />
                                                <label className="text-[11px] text-muted-foreground">y</label>
                                                <input
                                                    className="border rounded px-1 py-1 bg-background text-xs w-16"
                                                    type="number"
                                                    value={y}
                                                    disabled={disabled}
                                                    onChange={(e) =>
                                                        onUpdatePoint(idx, pIdx, [x, Math.round(Number(e.target.value) || 0)], label)
                                                    }
                                                />
                                                <select
                                                    className="border rounded px-1 py-1 bg-background text-xs w-20"
                                                    value={label}
                                                    disabled={disabled}
                                                    onChange={(e) => onUpdatePoint(idx, pIdx, [x, y], Number(e.target.value) ? 1 : 0)}
                                                >
                                                    <option value={1}>Pos</option>
                                                    <option value={0}>Neg</option>
                                                </select>

                                                {/* per-point delete icon (inline) */}
                                                <button
                                                    className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-accent disabled:opacity-50"
                                                    title="Remove point"
                                                    disabled={disabled}
                                                    onClick={() => onRemovePoint(idx, pIdx)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}