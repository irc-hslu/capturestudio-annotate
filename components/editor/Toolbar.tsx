"use client";

import { Button } from "@/components/ui/button";
import { useEditor } from "@/store/useEditor";
import { BoxSelect, Crosshair, Hand, MousePointer2, RotateCcw, RotateCw, Radar } from "lucide-react";

export function Toolbar({
                            onDetect,
                            disabled,
                            detecting = false,
                        }: {
    onDetect: () => void;
    disabled?: boolean;
    detecting?: boolean;
}) {
    const { tool, setTool, rotateCW, rotateCCW, showMask } = useEditor();

    // Disable interactions when viewing mask, plus any external disabled state
    const isDisabled = !!showMask || !!disabled;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
                <Button
                    variant={tool === "bbox" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTool("bbox")}
                    disabled={isDisabled}
                >
                    <BoxSelect className="w-4 h-4 mr-1" /> BBox
                </Button>
                <Button
                    variant={tool === "points" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTool("points")}
                    disabled={isDisabled}
                >
                    <Crosshair className="w-4 h-4 mr-1" /> Points
                </Button>
                <Button
                    variant={tool === "select" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTool("select")}
                    disabled={isDisabled}
                >
                    <MousePointer2 className="w-4 h-4 mr-1" /> Select
                </Button>
                <Button
                    variant={tool === "pan" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTool("pan")}
                    disabled={isDisabled}
                >
                    <Hand className="w-4 h-4 mr-1" /> Pan
                </Button>
            </div>

            <div className="mx-2 h-6 w-px bg-border" />

            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={rotateCCW}
                    title="Rotate 90° CCW"
                    disabled={isDisabled}
                >
                    <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={rotateCW}
                    title="Rotate 90° CW"
                    disabled={isDisabled}
                >
                    <RotateCw className="w-4 h-4" />
                </Button>
            </div>

            <div className="mx-2 h-6 w-px bg-border" />

            <Button
                variant="default"
                size="sm"
                onClick={onDetect}
                disabled={isDisabled || detecting}
            >
                <Radar className="w-4 h-4 mr-1" />
                {detecting ? "Detecting..." : "Detect"}
            </Button>
        </div>
    );
}