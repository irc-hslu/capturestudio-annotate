import type { Rotation, DetectionItem } from "./detections";

export type ApiError = { error: string };

/** /api/session POST */
export type ApiSessionOpenReq = { sessionPath: string; t?: number };
export type ApiSessionOpenRes = {
    sessionPath: string;
    cams: {
        idx: number;
        colorDir: string;
        frames: { t: number; filename: string; stem: string }[];
        firstStem: string | null;
    }[];
};

/** /api/frames GET */
export type ApiFramesReq = { sessionPath: string; camIdx: number };
export type ApiFramesRes = { frames: { t: number; filename: string; stem: string }[] };

/** /api/detections/get GET */
export type ApiDetectionsGetReq = { sessionPath: string; camIdx: number; stem: string };
export type ApiDetectionsGetRes = { detections: DetectionItem[] };

/** /api/detections/upsert POST */
export type ApiDetectionsUpsertReq = {
    sessionPath: string;
    camIdx: number;
    stem: string;
    index?: number | null;
    rotation?: Rotation;
    frameIdx?: number | null;
    item: DetectionItem;
};
export type ApiDetectionsUpsertRes = { detections: DetectionItem[] };

/** /api/detections/delete POST */
export type ApiDetectionsDeleteReq = { sessionPath: string; camIdx: number; stem: string; index: number };
export type ApiDetectionsDeleteRes = { detections: DetectionItem[] };

/** /api/detections/rotate POST */
export type ApiRotationSetReq = { sessionPath: string; camIdx: number; stem: string; rotation: Rotation };
export type ApiRotationSetRes = { rotation: Rotation };

/** /api/detect POST */
export type ApiDetectReq = {
    sessionPath: string;
    camIdx: number;
    t: number;
    rotation: Rotation; // server rotates pixels for inference
};
export type ApiDetectRes = { detections: DetectionItem[] };

/** /api/segment POST */
export type ApiSegmentReq = {
    sessionPath: string;
    camIdx: number;
    t: number;
    rotation: Rotation; // server rotates pixels for inference
    positivePoints?: number[][];
    negativePoints?: number[][];
};
export type ApiSegmentRes = { maskPngBase64: string };