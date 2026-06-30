"use client";

import {CamInfo} from "@/types/session";
import {CameraThumb} from "./CameraThumb";
import {Separator} from "@/components/ui/separator";

function clampInt(n: number, lo: number, hi: number) {
    return Math.min(Math.max(lo, Math.floor(n)), hi);
}

function camMaxIndex(cam: CamInfo): number {
    const anyCam = cam as any;
    const nFromFrames = Array.isArray((cam as any).frames) ? (cam as any).frames.length : 0;
    const nFromNumFrames = typeof anyCam.numFrames === "number" ? anyCam.numFrames : 0;
    const n = Math.max(nFromFrames, nFromNumFrames);
    return Math.max(0, n - 1);
}

export function CameraGrid({
                               sessionPath,
                               cams,
                               offsets,
                               onOpen,
                               activeCamIdx,
                               activeT,
                           }: {
    sessionPath: string;
    cams: CamInfo[];
    offsets: number[];
    onOpen: (camIdx: number, t: number) => void;
    activeCamIdx?: number;
    activeT?: number;
}) {
    const sortedOffsets = [...offsets].sort((a, b) => a - b);

    return (
        <div className="w-full">
            {sortedOffsets.map((off, i) => (
                <div key={off} className="mb-3">
                    <div className="text-xs text-muted-foreground mb-2 px-1">{`t=${off}`}</div>

                    <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))] w-full">
                        {cams.map((cam) => {
                            const hi = camMaxIndex(cam);
                            const t = clampInt(off, 0, hi);
                            const active = activeCamIdx === cam.idx && activeT === t;
                            return (
                                <CameraThumb
                                    key={`${cam.idx}-${off}`}
                                    sessionPath={sessionPath}
                                    camIdx={cam.idx}
                                    t={t}
                                    active={active}
                                    onClick={() => onOpen(cam.idx, t)}
                                />
                            );
                        })}
                    </div>

                    {i < sortedOffsets.length - 1 && <Separator className="mt-3"/>}
                </div>
            ))}
        </div>
    );
}