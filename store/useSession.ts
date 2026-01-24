import { create } from "zustand";
import type { CamInfo } from "@/types/session";

type State = {
    sessionPath: string;
    cams: CamInfo[];
    selectedCamIdx: number | null;
    tIndex: number;
    setSessionPath: (p: string) => void;
    setCams: (c: CamInfo[]) => void;
    setSelectedCamIdx: (i: number | null) => void;
    setTIndex: (t: number) => void;
    reset: () => void;
};

export const useSession = create<State>((set) => ({
    sessionPath: "",
    cams: [],
    selectedCamIdx: null,
    tIndex: 0,

    setSessionPath: (p) => set({ sessionPath: p }),
    setCams: (c) => set({ cams: c }),
    setSelectedCamIdx: (i) => set({ selectedCamIdx: i }),
    setTIndex: (t) => set({ tIndex: Math.max(0, Math.floor(t)) }),

    reset: () => set({ sessionPath: "", cams: [], selectedCamIdx: null, tIndex: 0 }),
}));