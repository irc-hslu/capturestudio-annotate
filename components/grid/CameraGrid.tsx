"use client";

import { CamInfo } from "@/types/session";
import { CameraThumb } from "./CameraThumb";
import { Separator } from "@/components/ui/separator";

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
            {sortedOffsets.map((off) => (
                <div key={off} className="mb-3">
                    <div className="text-xs text-muted-foreground mb-2 px-1">
                        {off === 0 ? "t0" : off > 0 ? `t+${off}` : `t${off}`}
                    </div>

                    <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))] w-full">
                        {cams.map((cam) => {
                            const t = Math.max(0, off);
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

                    <Separator className="mt-3" />
                </div>
            ))}
        </div>
    );
}