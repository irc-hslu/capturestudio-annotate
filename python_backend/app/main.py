import base64
import io
import os
from typing import Any

import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .inference import Sam3Wrapper
from .models import DetectRequest, DetectResponse, DetectionItem, SegmentRequest, SegmentResponse


# Config
BACKEND_PORT = int(os.environ.get("BACKEND_PORT", "8060"))
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app = FastAPI(title="Annotator Inference Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_sam = Sam3Wrapper(default_classes=('person', 'guitar', 'guitar strap', 'guitar band', 'drums', 'piano', 'keyboard', 'microphone head', 'recording microphone dust cover'))


@app.get("/healthz")
def health() -> dict[str, Any]:
    return {"status": "ok"}


@app.post("/detect", response_model=DetectResponse)
def detect(req: DetectRequest) -> DetectResponse:
    if not os.path.exists(req.image_path):
        return DetectResponse(width=0, height=0, detections=[])

    bgr = cv2.imread(req.image_path, cv2.IMREAD_COLOR)
    if bgr is None:
        return DetectResponse(width=0, height=0, detections=[])

    # Inline rotation
    if req.rotation and req.rotation.upper() != "NONE":
        bgr = cv2.rotate(bgr, getattr(cv2, f"ROTATE_{req.rotation.upper()}"))

    h, w = int(bgr.shape[0]), int(bgr.shape[1])

    dets = _sam.detect(
        bgr,
        min_confidence=req.min_confidence,
        class_names=req.class_names if hasattr(req, "class_names") else None,
    )
    items = [DetectionItem(**d) for d in dets]

    _sam.reset()
    return DetectResponse(width=w, height=h, detections=items)


@app.post("/segment", response_model=SegmentResponse)
def segment(req: SegmentRequest) -> SegmentResponse:
    if not os.path.exists(req.image_path):
        return SegmentResponse(width=0, height=0, mask_png_base64="")

    bgr = cv2.imread(req.image_path, cv2.IMREAD_COLOR)
    if bgr is None:
        return SegmentResponse(width=0, height=0, mask_png_base64="")

    # Inline rotation
    if req.rotation and req.rotation.upper() != "NONE":
        bgr = cv2.rotate(bgr, getattr(cv2, f"ROTATE_{req.rotation.upper()}"))

    h, w = int(bgr.shape[0]), int(bgr.shape[1])

    # Optional points (+ labels)
    pts = req.points if hasattr(req, "points") else None
    labs = req.point_labels if hasattr(req, "point_labels") else None

    # Optional bbox overrides: convert to detector-format detections
    dets_override = None
    if req.bboxes and len(req.bboxes) > 0:
        dets_override = [
            {
                "bbox": [float(x1), float(y1), float(x2), float(y2)],
                "confidence": 1.0,
                "class_name": "manual",
                "class_id": 0,
            }
            for (x1, y1, x2, y2) in req.bboxes
        ]

    # Run segmentation with optional detections & points
    mask_u8 = _sam.segment(
        bgr,
        detections=dets_override,
        points=pts,
        point_labels=labs,
    )

    _sam.reset()

    # Encode to PNG base64
    mask_u8 = (mask_u8 > 0).astype(np.uint8) * 255
    pil = Image.fromarray(mask_u8, mode="L")
    buf = io.BytesIO()
    pil.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return SegmentResponse(width=w, height=h, mask_png_base64=b64)
