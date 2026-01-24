"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimestampBadge } from "./TimestampBadge";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";

export type TimestampStripProps = {
    baseT?: number; // usually 0
    offsets: number[]; // includes 0 (base) and extra positive/negative frame offsets
    selectedOffset: number;
    onSelect: (offset: number) => void;
    onAdd: (offset: number) => void;
    onRemove: (offset: number) => void;
};

export function TimestampStrip({
                                   baseT = 0,
                                   offsets,
                                   selectedOffset,
                                   onSelect,
                                   onAdd,
                                   onRemove,
                               }: TimestampStripProps) {
    const [val, setVal] = useState<string>("");

    const sorted = useMemo(() => [...offsets].sort((a, b) => a - b), [offsets]);

    return (
        <div className="w-full flex flex-col gap-2 p-2">
            <div className="flex items-center gap-2">
                <Input
                    className="max-w-[140px]"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    placeholder="Offset (frames)"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            const n = parseInt(val, 10);
                            if (!Number.isNaN(n)) {
                                onAdd(n);
                                setVal("");
                            }
                        }
                    }}
                />
                <Button
                    variant="outline"
                    onClick={() => {
                        const n = parseInt(val, 10);
                        if (!Number.isNaN(n)) {
                            onAdd(n);
                            setVal("");
                        }
                    }}
                >
                    <Plus className="w-4 h-4 mr-1" /> Add Timestamp
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
        </div>
    );
}