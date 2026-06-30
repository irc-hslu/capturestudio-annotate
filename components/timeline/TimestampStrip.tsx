"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TimestampBadge } from "./TimestampBadge";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

export type TimestampStripProps = {
    baseT?: number; // usually 0
    offsets: number[]; // includes 0 (base) and extra time steps
    selectedOffset: number;
    onSelect: (offset: number) => void;
    onAdd: (offset: number) => void;
    onRemove: (offset: number) => void;

    // NEW: slider bounds
    minOffset?: number;
    maxOffset?: number;

    // NEW: show title and right-floating add button
    title?: string;
};

function clampInt(n: number, lo: number, hi: number) {
    return Math.min(Math.max(lo, Math.floor(n)), hi);
}

export function TimestampStrip({
    baseT = 0,
    offsets,
    selectedOffset,
    onSelect,
    onAdd,
    onRemove,
    minOffset = 0,
    maxOffset = 0,
    title = "Timeline",
}: TimestampStripProps) {
    const sorted = useMemo(() => [...offsets].sort((a, b) => a - b), [offsets]);

    const [open, setOpen] = useState(false);
    const [sliderVal, setSliderVal] = useState<number[]>([0]);

    useEffect(() => {
        const hi = Math.max(minOffset, maxOffset);
        const v = clampInt(selectedOffset, minOffset, hi);
        setSliderVal([v]);
    }, [selectedOffset, minOffset, maxOffset]);

    const hi = Math.max(minOffset, maxOffset);
    const current = clampInt(sliderVal[0] ?? 0, minOffset, hi);

    return (
        <div className="w-full flex flex-col gap-2 p-2">
            {/* Title + right-floating button in same row */}
            <div className="flex items-center justify-between gap-2">
                <div className="text-base font-semibold">{title}</div>
                <Button
                    variant="outline"
                    onClick={() => {
                        const v = clampInt(selectedOffset, minOffset, hi);
                        setSliderVal([v]);
                        setOpen(true);
                    }}
                >
                    <Plus className="w-4 h-4 mr-1" /> Add time step
                </Button>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
                {sorted.map((off) => (
                    <TimestampBadge
                        key={off}
                        baseT={baseT}
                        offset={off}
                        active={off === selectedOffset}
                        onSelect={() => onSelect(off)}
                        onRemove={() => onRemove(off)}
                    />
                ))}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Select time step</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col gap-3">
                        <div className="text-sm text-muted-foreground">
                            t = <span className="font-medium text-foreground">{current}</span>
                        </div>

                        <Slider
                            min={minOffset}
                            max={hi}
                            step={1}
                            value={[current]}
                            onValueChange={(v) => {
                                const n = clampInt(v[0] ?? 0, minOffset, hi);
                                setSliderVal([n]);
                            }}
                        />
                        <div className="text-xs text-muted-foreground">
                            Range: [{minOffset}, {hi}]
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                onAdd(current);
                                setOpen(false);
                            }}
                        >
                            Add
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}