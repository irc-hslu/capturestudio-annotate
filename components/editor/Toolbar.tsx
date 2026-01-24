"use client";

import { Button } from "@/components/ui/button";
import { useEditor } from "@/store/useEditor";
import { Switch } from "@/components/ui/switch";
import { BoxSelect, Crosshair, Hand, MousePointer2, RotateCcw, RotateCw, Radar } from "lucide-react";

export function Toolbar({ onDetect, onSegment }: { onDetect: () => void; onSegment: () => void }) {
    const { tool, setTool, rotateCW, rotateCCW, maskUrl, showMask, setShowMask } = useEditor();

    const disabled = !!showMask; // disable while viewing mask

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
                <Button variant={tool === "bbox" ? "default" : "outline"} size="sm" onClick={() => setTool("bbox")} disabled={disabled}>
                    <BoxSelect className="w-4 h-4 mr-1" /> BBox
                </Button>
                <Button variant={tool === "points" ? "default" : "outline"} size="sm" onClick={() => setTool("points")} disabled={disabled}>
                    <Crosshair className="w-4 h-4 mr-1" /> Points
                </Button>
                <Button variant={tool === "select" ? "default" : "outline"} size="sm" onClick={() => setTool("select")} disabled={disabled}>
                    <MousePointer2 className="w-4 h-4 mr-1" /> Select
                </Button>
                <Button variant={tool === "pan" ? "default" : "outline"} size="sm" onClick={() => setTool("pan")} disabled={disabled}>
                    <Hand className="w-4 h-4 mr-1" /> Pan
                </Button>
            </div>

            <div className="mx-2 h-6 w-px bg-border" />

            <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={rotateCCW} title="Rotate 90° CCW" disabled={disabled}>
                    <RotateCcw className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={rotateCW} title="Rotate 90° CW" disabled={disabled}>
                    <RotateCw className="w-4 h-4" />
                </Button>
            </div>

            <div className="mx-2 h-6 w-px bg-border" />

            <Button variant="default" size="sm" onClick={onDetect} disabled={disabled}>
                <Radar className="w-4 h-4 mr-1" /> Detect
            </Button>

            {maskUrl ? (
                <div className="ml-3 text-xs flex items-center gap-2">
                    <span>Show mask</span>
                    <Switch checked={showMask} onCheckedChange={setShowMask} />
                </div>
            ) : null}
        </div>
    );
}