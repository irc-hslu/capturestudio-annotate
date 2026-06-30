"use client";

import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TimestampBadge({
    baseT,
    offset,
    active,
    onSelect,
    onRemove,
}: {
    baseT: number;
    offset: number;
    active?: boolean;
    onSelect?: () => void;
    onRemove?: () => void;
}) {
    const label = `t=${baseT + offset}`;
    return (
        <div className={cn("inline-flex items-center gap-1")}>
            <Badge
                variant={active ? "default" : "secondary"}
                className="cursor-pointer"
                onClick={onSelect}
            >
                {label}
            </Badge>
            {offset !== 0 && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onRemove}
                    aria-label="remove timestamp"
                >
                    <X className="w-3 h-3" />
                </Button>
            )}
        </div>
    );
}