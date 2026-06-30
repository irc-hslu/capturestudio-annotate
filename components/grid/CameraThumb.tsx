"use client";

import Image from "next/image";
import {useEffect, useState} from "react";
import {cn} from "@/lib/utils";

export function CameraThumb({
                                sessionPath,
                                camIdx,
                                t,
                                onClick,
                                active = false,
                            }: {
    sessionPath: string;
    camIdx: number;
    t: number;
    onClick: () => void;
    active?: boolean;
}) {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        let objUrl: string | null = null;

        const u = `/api/image?sessionPath=${encodeURIComponent(sessionPath)}&camIdx=${camIdx}&t=${t}`;
        fetch(u)
            .then((r) => (r.ok ? r.blob() : Promise.reject()))
            .then((b) => {
                if (!alive) return;
                objUrl = URL.createObjectURL(b);
                setUrl(objUrl);
            })
            .catch(() => {
            });

        return () => {
            alive = false;
            if (objUrl) URL.revokeObjectURL(objUrl);
        };
    }, [sessionPath, camIdx, t]);

    return (
        <button
            className={cn(
                "group relative border rounded-md overflow-hidden aspect-video bg-muted hover:ring-2 hover:ring-primary",
                active && "ring-2 ring-primary"
            )}
            onClick={onClick}
            title={`cam${String(camIdx).padStart(2, "0")} t=${t}`}
        >
            {url ? (
                <Image src={url} alt="" fill className="object-cover"/>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                    Loading…
                </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[10px] px-1 py-0.5">
                cam{String(camIdx).padStart(2, "0")} · t={t}
            </div>
        </button>
    );
}