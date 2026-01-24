from typing import List, Optional, Literal, Tuple
from pydantic import BaseModel, Field

RotationStr = Literal["NONE", "90_CLOCKWISE", "90_COUNTERCLOCKWISE", "180"]


class DetectionItem(BaseModel):
    bbox: List[float] = Field(..., description="xyxy [x1,y1,x2,y2] in rotated frame if rotation supplied")
    confidence: float = 1.0
    class_name: str = "person"
    class_id: int = 0


class DetectRequest(BaseModel):
    image_path: str
    rotation: RotationStr = "NONE"
    min_confidence: float = 0.3
    class_names: Optional[List[str]] = None


class DetectResponse(BaseModel):
    width: int
    height: int
    detections: List[DetectionItem] = []


class SegmentRequest(BaseModel):
    image_path: str
    rotation: RotationStr = "NONE"
    # points & labels in rotated frame AFTER server rotation. We rotate the image first,
    # so treat incoming bboxes/points as given for the same rotated view (UI passes rotation too).
    bboxes: Optional[List[Tuple[float,float,float,float]]] = None  # [x1,y1,x2,y2] in rotated frame
    points: Optional[List[Tuple[float, float]]] = None
    point_labels: Optional[List[int]] = None


class SegmentResponse(BaseModel):
    width: int
    height: int
    mask_png_base64: str  # base64-encoded PNG with 0 background, 255 foreground
