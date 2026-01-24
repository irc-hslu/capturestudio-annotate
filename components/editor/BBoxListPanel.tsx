"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { DetectionItem } from "@/types/detections";
import { Pencil, Trash2 } from "lucide-react";

export function BBoxListPanel({
                                  items,
                                  onDelete,
                                  onChange,
                                  onEnterEdit,
                                  disabled,
                              }: {
    items: DetectionItem[];
    onDelete: (index: number) => void;
    onChange: (index: number, xyxy: [number, number, number, number]) => void;
    onEnterEdit?: (index: number) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex flex-col min-h-0">
            <ScrollArea className="flex-1 min-h-0 pr-2">
                <div className="flex flex-col gap-2">
                    {items.map((it, i) => {
                        if (!it.bbox) return null;
                        const [x1, y1, x2, y2] = it.bbox.map((v) => Math.round(Number(v))) as [
                            number,
                            number,
                            number,
                            number
                        ];
                        return (
                            <div key={i} className="relative border rounded-md p-2">
                                {/* top-right action icons */}
                                <div className="absolute top-1 right-1 flex items-center gap-1">
                                    <button
                                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-accent disabled:opacity-50"
                                        title="Edit on canvas"
                                        disabled={disabled}
                                        onClick={() => onEnterEdit?.(i)}
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-accent disabled:opacity-50"
                                        title="Delete"
                                        disabled={disabled}
                                        onClick={() => onDelete(i)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* header */}
                                <div className="text-[11px] font-medium mb-2 pr-16">
                                    {it.class_name} (id {it.class_id})
                                </div>

                                {/* coords inline, single row */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <label className="text-[11px] text-muted-foreground">x1</label>
                                    <input
                                        className="border rounded px-1 py-1 bg-background text-xs w-16"
                                        type="number"
                                        value={x1}
                                        disabled={disabled}
                                        onChange={(e) => {
                                            const nv = Math.round(Number(e.target.value) || 0);
                                            onChange(i, [nv, y1, x2, y2]);
                                        }}
                                    />
                                    <label className="text-[11px] text-muted-foreground">y1</label>
                                    <input
                                        className="border rounded px-1 py-1 bg-background text-xs w-16"
                                        type="number"
                                        value={y1}
                                        disabled={disabled}
                                        onChange={(e) => {
                                            const nv = Math.round(Number(e.target.value) || 0);
                                            onChange(i, [x1, nv, x2, y2]);
                                        }}
                                    />
                                    <label className="text-[11px] text-muted-foreground">x2</label>
                                    <input
                                        className="border rounded px-1 py-1 bg-background text-xs w-16"
                                        type="number"
                                        value={x2}
                                        disabled={disabled}
                                        onChange={(e) => {
                                            const nv = Math.round(Number(e.target.value) || 0);
                                            onChange(i, [x1, y1, nv, y2]);
                                        }}
                                    />
                                    <label className="text-[11px] text-muted-foreground">y2</label>
                                    <input
                                        className="border rounded px-1 py-1 bg-background text-xs w-16"
                                        type="number"
                                        value={y2}
                                        disabled={disabled}
                                        onChange={(e) => {
                                            const nv = Math.round(Number(e.target.value) || 0);
                                            onChange(i, [x1, y1, x2, nv]);
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}