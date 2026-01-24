import { create } from "zustand";
import type { Rotation } from "@/types/detections";

type Tool = "bbox" | "points" | "pan" | "select";

type State = {
    rotation: Rotation;
    tool: Tool;

    // Mask UI/availability state (global for now)
    showMask: boolean;
    maskAvailable: boolean; // there is a mask on disk / URL set
    maskUrl: string | null; // served by /api/mask/get
    maskDirty: boolean;     // annotations changed after last mask compute

    setRotation: (r: Rotation) => void;
    setTool: (t: Tool) => void;

    // NEW: rotate helpers
    rotateCW: () => void;
    rotateCCW: () => void;

    setShowMask: (b: boolean) => void;
    setMaskAvailable: (b: boolean) => void;
    setMaskUrl: (u: string | null) => void;
    setMaskDirty: (b: boolean) => void;

    // convenience: called whenever detections/points change
    invalidateMask: () => void;

    reset: () => void;
};

const CW_MAP: Record<Rotation, Rotation> = {
    NONE: "90_CLOCKWISE",
    "90_CLOCKWISE": "180",
    "180": "90_COUNTERCLOCKWISE",
    "90_COUNTERCLOCKWISE": "NONE",
};

const CCW_MAP: Record<Rotation, Rotation> = {
    NONE: "90_COUNTERCLOCKWISE",
    "90_COUNTERCLOCKWISE": "180",
    "180": "90_CLOCKWISE",
    "90_CLOCKWISE": "NONE",
};

export const useEditor = create<State>((set) => ({
    rotation: "NONE",
    tool: "bbox",

    showMask: false,
    maskAvailable: false,
    maskUrl: null,
    maskDirty: false,

    setRotation: (r) => set({ rotation: r }),
    setTool: (t) => set({ tool: t }),

    // NEW: rotate helpers (also hide mask so we don't show stale overlay)
    rotateCW: () =>
        set((s) => ({
            rotation: CW_MAP[s.rotation],
            showMask: false,
        })),
    rotateCCW: () =>
        set((s) => ({
            rotation: CCW_MAP[s.rotation],
            showMask: false,
        })),

    setShowMask: (b) => set({ showMask: b }),
    setMaskAvailable: (b) => set({ maskAvailable: b }),
    setMaskUrl: (u) => set({ maskUrl: u }),
    setMaskDirty: (b) => set({ maskDirty: b }),

    invalidateMask: () =>
        set({
            showMask: false,
            maskDirty: true,
            // keep existing file on disk, but treat it as invalid
            // don't clear maskUrl/maskAvailable here; UI logic uses maskDirty to enable the button
        }),

    reset: () =>
        set({
            rotation: "NONE",
            tool: "bbox",
            showMask: false,
            maskAvailable: false,
            maskUrl: null,
            maskDirty: false,
        }),
}));