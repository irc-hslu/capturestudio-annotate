"use client";

export function ClassColorSwatch({ color }: { color: string }) {
    return (
        <div
            className="w-4 h-4 rounded-full border"
            style={{ backgroundColor: color }}
            aria-label={`color ${color}`}
        />
    );
}