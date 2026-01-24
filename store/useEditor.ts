// import { create } from "zustand";
// import type { Rotation } from "@/types/detections";
//
// type Tool = "bbox" | "points" | "pan" | "select";
//
// type State = {
//     rotation: Rotation;
//     tool: Tool;
//
//     positivePoints: number[][];
//     negativePoints: number[][];
//
//     maskUrl: string | null;
//     showMask: boolean;
//     isSegmenting: boolean;
//
//     setRotation: (r: Rotation) => void;
//     rotateCW: () => void;
//     rotateCCW: () => void;
//
//     setTool: (t: Tool) => void;
//
//     addPositivePoint: (p: [number, number]) => void;
//     addNegativePoint: (p: [number, number]) => void;
//     clearPoints: () => void;
//
//     setMaskUrl: (u: string | null) => void;
//     setShowMask: (b: boolean) => void;
//     setIsSegmenting: (b: boolean) => void;
//
//     reset: () => void;
// };
//
// function nextCW(r: Rotation): Rotation {
//     switch (r) {
//         case "NONE": return "90_CLOCKWISE";
//         case "90_CLOCKWISE": return "180";
//         case "180": return "90_COUNTERCLOCKWISE";
//         case "90_COUNTERCLOCKWISE": return "NONE";
//     }
// }
//
// function nextCCW(r: Rotation): Rotation {
//     switch (r) {
//         case "NONE": return "90_COUNTERCLOCKWISE";
//         case "90_COUNTERCLOCKWISE": return "180";
//         case "180": return "90_CLOCKWISE";
//         case "90_CLOCKWISE": return "NONE";
//     }
// }
//
// export const useEditor = create<State>((set, get) => ({
//     rotation: "NONE",
//     tool: "select",
//
//     positivePoints: [],
//     negativePoints: [],
//
//     maskUrl: null,
//     showMask: false,           // not shown by default
//     isSegmenting: false,
//
//     setRotation: (r) => set({ rotation: r }),
//     rotateCW: () => set({ rotation: nextCW(get().rotation) }),
//     rotateCCW: () => set({ rotation: nextCCW(get().rotation) }),
//
//     setTool: (t) => set({ tool: t }),
//
//     addPositivePoint: (p) => set((s) => ({ positivePoints: [...s.positivePoints, p] })),
//     addNegativePoint: (p) => set((s) => ({ negativePoints: [...s.negativePoints, p] })),
//     clearPoints: () => set({ positivePoints: [], negativePoints: [] }),
//
//     setMaskUrl: (u) => set({ maskUrl: u }),
//     setShowMask: (b) => set({ showMask: b }),
//     setIsSegmenting: (b) => set({ isSegmenting: b }),
//
//     reset: () =>
//         set({
//             rotation: "NONE",
//             tool: "select",
//             positivePoints: [],
//             negativePoints: [],
//             maskUrl: null,
//             showMask: false,
//             isSegmenting: false,
//         }),
// }));

"use client";

import { create } from "zustand";
import type { Rotation } from "@/types/detections";

type Tool = "bbox" | "points" | "pan" | "select";

type State = {
    rotation: Rotation;
    tool: Tool;

    // point drawing buffers (UI)
    positivePoints: number[][];
    negativePoints: number[][];

    // mask lifecycle
    maskUrl: string | null;       // served by /api/mask/get
    maskAvailable: boolean;       // a mask file exists on disk
    maskDirty: boolean;           // edits since last segmentation => needs recompute
    showMask: boolean;            // overlay toggle
    isSegmenting: boolean;

    // setters
    setRotation: (r: Rotation) => void;
    setTool: (t: Tool) => void;
    addPositivePoint: (p: [number, number]) => void;
    addNegativePoint: (p: [number, number]) => void;
    clearPoints: () => void;

    setMaskUrl: (u: string | null) => void;
    setMaskAvailable: (b: boolean) => void;
    setMaskDirty: (b: boolean) => void;
    setShowMask: (b: boolean) => void;
    setIsSegmenting: (b: boolean) => void;

    // convenience: when any annotation changes
    invalidateMask: () => void;

    reset: () => void;
};

export const useEditor = create<State>((set, get) => ({
    rotation: "NONE",
    tool: "bbox",

    positivePoints: [],
    negativePoints: [],

    maskUrl: null,
    maskAvailable: false,
    maskDirty: false,
    showMask: false,
    isSegmenting: false,

    setRotation: (r) => set({ rotation: r }),
    setTool: (t) => set({ tool: t }),

    addPositivePoint: (p) => set((s) => ({ positivePoints: [...s.positivePoints, p] })),
    addNegativePoint: (p) => set((s) => ({ negativePoints: [...s.negativePoints, p] })),
    clearPoints: () => set({ positivePoints: [], negativePoints: [] }),

    setMaskUrl: (u) => set({ maskUrl: u }),
    setMaskAvailable: (b) => set({ maskAvailable: b }),
    setMaskDirty: (b) => set({ maskDirty: b }),
    setShowMask: (b) => set({ showMask: b }),
    setIsSegmenting: (b) => set({ isSegmenting: b }),

    invalidateMask: () => {
        const { maskAvailable, showMask } = get();
        set({
            maskDirty: true,
            // if user was viewing a stale mask, hide it as soon as annotations change
            showMask: showMask ? false : showMask,
            // keep maskAvailable true (file still exists on disk), but considered stale
            maskAvailable,
        });
    },

    reset: () =>
        set({
            rotation: "NONE",
            tool: "bbox",
            positivePoints: [],
            negativePoints: [],
            maskUrl: null,
            maskAvailable: false,
            maskDirty: false,
            showMask: false,
            isSegmenting: false,
        }),
}));