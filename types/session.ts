export type CamFrame = { t: number; filename: string; stem: string };

export type CamInfo = {
    idx: number;
    colorDir: string;
    frames: CamFrame[];
    firstStem: string | null;
};

export type SessionOpenResponse = {
    sessionPath: string;
    cams: CamInfo[];
};