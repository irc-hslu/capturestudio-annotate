import { create } from "zustand";
import type { DetectionItem } from "@/types/detections";

type DetectionsState = {
    // detections grouped by a stable key `${camIdx}:${stem}`
    byKey: Record<string, DetectionItem[]>;
    // stable empty reference to avoid re-renders / infinite loops
    empty: ReadonlyArray<DetectionItem>;

    /** Return the array for a key; if missing, returns the stable `empty` reference. */
    getForKey: (key: string) => ReadonlyArray<DetectionItem>;

    /** Replace entire list for a key (keeps reference if unchanged). */
    setForKey: (key: string, items: DetectionItem[]) => void;

    /** Upsert (replace) a single index immutably. */
    setAtIndex: (key: string, index: number, item: DetectionItem) => void;

    /** Remove a single index immutably. */
    removeAtIndex: (key: string, index: number) => void;

    /** Clear a key back to empty. */
    clearKey: (key: string) => void;
};

const EMPTY: DetectionItem[] = Object.freeze([]) as DetectionItem[];

export const useDetections = create<DetectionsState>((set, get) => ({
    byKey: Object.create(null),
    empty: EMPTY,

    getForKey: (key) => {
        const arr = get().byKey[key];
        return arr ?? EMPTY;
    },

    setForKey: (key, items) =>
        set((s) => {
            const prev = s.byKey[key];
            // Avoid resetting to same reference; helps selectors stay stable
            if (prev === items) return s;
            return { byKey: { ...s.byKey, [key]: items } };
        }),

    setAtIndex: (key, index, item) =>
        set((s) => {
            const prev = s.byKey[key] ?? EMPTY;
            if (index < 0 || index >= prev.length) return s;
            // Create a new array with the updated item
            const next = prev.slice();
            next[index] = item;
            return { byKey: { ...s.byKey, [key]: next } };
        }),

    removeAtIndex: (key, index) =>
        set((s) => {
            const prev = s.byKey[key] ?? EMPTY;
            if (index < 0 || index >= prev.length) return s;
            const next = prev.slice(0, index).concat(prev.slice(index + 1));
            return { byKey: { ...s.byKey, [key]: next } };
        }),

    clearKey: (key) =>
        set((s) => {
            if (!(key in s.byKey)) return s;
            const next = { ...s.byKey };
            delete next[key];
            return { byKey: next };
        }),
}));