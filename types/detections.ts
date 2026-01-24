export type Rotation = "NONE" | "90_COUNTERCLOCKWISE" | "90_CLOCKWISE" | "180";
export type XYXY = [number, number, number, number];

export type DetectionItem = {
    // One of these will be present depending on rotation policy.
    bbox?: XYXY;
    bbox_rotated_90_COUNTERCLOCKWISE?: XYXY;
    bbox_rotated_90_CLOCKWISE?: XYXY;
    bbox_rotated_180?: XYXY;

    points?: number[][];
    points_rotated_90_COUNTERCLOCKWISE?: number[][];
    points_rotated_90_CLOCKWISE?: number[][];
    points_rotated_180?: number[][];

    point_labels?: number[]; // 1: positive, 0: negative
    confidence: number;
    class_name: string;
    class_id: number;
    frame_idx?: number;
};