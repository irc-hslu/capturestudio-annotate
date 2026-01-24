import path from "path";

/** {session}/orbbec/cam{idx}/color */
export function colorDirPath(sessionPath: string, camIdx: number) {
    const cam = String(camIdx).padStart(2, "0");
    return path.join(sessionPath, "orbbec", `cam${cam}`, "color");
}

/** {session}/orbbec/cam{idx}/mask */
export function maskDirPath(sessionPath: string, camIdx: number) {
    const cam = String(camIdx).padStart(2, "0");
    return path.join(sessionPath, "orbbec", `cam${cam}`, "mask");
}

/** {session}/orbbec/cam{idx}/mask/detections-<stem>.json */
export function detectionsPath(sessionPath: string, camIdx: number, stem: string) {
    return path.join(maskDirPath(sessionPath, camIdx), `detections-${stem}.json`);
}

/** {session}/orbbec/cam{idx}/mask/rotation-<stem>.json */
export function rotationMetaPath(sessionPath: string, camIdx: number, stem: string) {
    return path.join(maskDirPath(sessionPath, camIdx), `rotation-${stem}.json`);
}