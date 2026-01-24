import { create } from "zustand";

export type ClassDef = { id: number; name: string; color: string };

type State = {
    classes: ClassDef[];
    activeClassId: number | null;
    addClass: (name: string, color?: string) => void;
    setActiveClass: (id: number | null) => void;
    resetDefaults: () => void;
};

const DEFAULTS: ClassDef[] = [
    { id: 0, name: "person", color: "#22c55e" },
    { id: 1, name: "guitar", color: "#f59e0b" },
    { id: 2, name: "guitar strap", color: "#f5780b" },
    { id: 3, name: "mic_head", color: "#a855f7" },
];

function nextColor(n: number): string {
    // simple golden-angle palette
    const hue = (n * 137.508) % 360;
    return `hsl(${hue} 85% 55%)`;
}

export const useClasses = create<State>((set, get) => ({
    classes: DEFAULTS,
    activeClassId: 0,
    addClass: (name, color) =>
        set((s) => {
            const id = s.classes.length ? Math.max(...s.classes.map((c) => c.id)) + 1 : 0;
            const newC = { id, name, color: color ?? nextColor(id) };
            return { classes: [...s.classes, newC] };
        }),
    setActiveClass: (id) => set({ activeClassId: id }),
    resetDefaults: () => set({ classes: DEFAULTS.slice(), activeClassId: 0 }),
}));