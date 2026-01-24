from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
import os

import numpy as np
import cv2
import torch
import torchvision.ops as ops
from PIL import Image


class Sam3Wrapper:
    """
    SAM3 detector wrapper (text-prompted instance segmentation used as detection).

    - Loads a SAM3 image model once from checkpoints/sam/sam3.pt (or SAM3_CKPT env).
    - Predicts on BGR images (np.uint8), returns detections as dictionaries:
        {
          "bbox": [x1, y1, x2, y2],      # from mask bounding box, in the same (rotated) frame
          "confidence": float,           # SAM3 instance score
          "class_name": str,             # the requested class name (text prompt)
          "class_id": int                # index within the requested class_names list (default 'person' -> 0)
        }
    """

    def __init__(
            self,
            device: Optional[str] = None,
            default_classes: Sequence[str] = ("person",),
            iou: float = 0.5,
    ) -> None:
        device = (device or os.environ.get("SAM3_DEVICE") or "cuda")

        self.default_classes = [str(c).lower() for c in default_classes]
        self.iou = float(iou)

        # ---- Load SAM3 once ----
        from sam3.model_builder import build_sam3_image_model
        from sam3.model.sam3_image_processor import Sam3Processor

        ckpt = os.environ.get("SAM3_CKPT")
        if not ckpt:
            ckpt = str(
                (Path(os.environ.get("TORCH_HOME", str("."))) / "checkpoints" / "sam" / "sam3.pt").resolve()
            )

        self.model = build_sam3_image_model(
            checkpoint_path=ckpt,
            eval_mode=True,
            device=device,
        )
        self.processor = Sam3Processor(self.model)
        self.device = device

        # Cached per-image state (set by _ensure_image). Caller should call reset() between images.
        self._state: Optional[Any] = None
        self._size: Optional[Tuple[int, int]] = None  # (H, W)

    def reset(self) -> None:
        """Clear cached image state; call this between requests/images."""
        self.processor.reset_all_prompts(self._state)
        self._state = None
        self._size = None
        import gc
        gc.collect()
        torch.cuda.empty_cache()

    def _ensure_image(self, image_bgr: np.ndarray) -> None:
        if self._state is None:
            image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
            pil = Image.fromarray(image_rgb)
            with torch.inference_mode():
                self._state = self.processor.set_image(pil)
            H, W = image_rgb.shape[:2]
            self._size = (H, W)

    def detect(
            self,
            image_bgr: np.ndarray,
            min_confidence: float = 0.7,
            class_names: Optional[Sequence[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Run text-prompted detection via SAM3.
        """
        print('Detecting with SAM3...')
        print('min_confidence:', min_confidence, 'class_names:', class_names)
        print('')
        if image_bgr is None or image_bgr.ndim != 3:
            return []

        classes = [c.lower() for c in (class_names if class_names is not None else self.default_classes)]
        if not classes:
            classes = ["person"]

        catalog_map = {name: i for i, name in enumerate(classes)}

        self._ensure_image(image_bgr)
        H, W = self._size  # type: ignore

        results_per_class: Dict[str, List[Tuple[List[float], float]]] = {c: [] for c in classes}

        # Prompt per class and collect boxes/scores
        for cls in classes:
            with torch.inference_mode():
                out = self.processor.set_text_prompt(state=self._state, prompt=cls)  # type: ignore

            boxes = out.get("boxes", [])
            scores = out.get("scores", [])

            if isinstance(boxes, torch.Tensor):
                boxes = boxes.detach().cpu().numpy()
            else:
                boxes = np.asarray(boxes) if len(boxes) else np.zeros((0, 4), dtype=np.float32)

            if isinstance(scores, torch.Tensor):
                scores = scores.detach().cpu().numpy().astype(np.float32)
            else:
                scores = np.asarray(scores, dtype=np.float32) if len(scores) else np.zeros((0,), dtype=np.float32)

            for bbox, score in zip(boxes, scores):
                score = float(score)
                if score < min_confidence:
                    continue
                x1, y1, x2, y2 = float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
                x1 = max(0.0, min(W - 1.0, x1))
                y1 = max(0.0, min(H - 1.0, y1))
                x2 = max(0.0, min(W - 1.0, x2))
                y2 = max(0.0, min(H - 1.0, y2))
                if x2 <= x1 or y2 <= y1:
                    continue
                results_per_class[cls].append(([x1, y1, x2, y2], score))

        # Per-class NMS
        detections: List[Dict[str, Any]] = []
        for cls, items in results_per_class.items():
            if not items:
                continue
            b = np.array([it[0] for it in items], dtype=np.float32)
            s = np.array([it[1] for it in items], dtype=np.float32)
            keep = self._nms(b, s, self.iou)
            for i in keep:
                x1, y1, x2, y2 = b[i].tolist()
                detections.append(
                    {
                        "bbox": [float(x1), float(y1), float(x2), float(y2)],
                        "confidence": float(s[i]),
                        "class_name": cls,
                        "class_id": int(catalog_map.get(cls, 0)),
                    }
                )
        return detections

    def segment(
            self,
            image_bgr: np.ndarray,
            min_confidence: float = 0.3,
            class_names: Optional[Sequence[str]] = None,
            mask_threshold: float = 0.5,
            detections: Optional[List[Dict[str, Any]]] = None,
            points: Optional[Sequence[Tuple[float, float]]] = None,
            point_labels: Optional[Sequence[int]] = None,
    ) -> np.ndarray:
        """
        Segment by first detecting (text prompts), then predicting masks using detected boxes via
        `add_geometric_prompt`. For each bbox, all masks returned by SAM3 are unified into a bbox-
        level mask constrained to the bbox (+/- 3 px), and finally merged into a single image-wide mask.

        Also supports point prompts (positive/negative): points are treated as tiny 3x3 boxes with
        labels mapped to {1 -> True (positive), 0 -> False (negative)} and added as geometric prompts.

        Returns: (H,W) uint8 mask with {0,255}.
        """
        # Detect if detections not provided
        detections = detections or self.detect(
            image_bgr,
            min_confidence=min_confidence,
            class_names=class_names,
        )

        # Ensure per-image state is set if called standalone
        self._ensure_image(image_bgr)
        H, W = self._size  # type: ignore

        unified = np.zeros((H, W), dtype=bool)
        pad = 3  # pixels of tolerance around bbox edges

        # Pre-normalized point boxes if provided (3x3 around each point)
        norm_point_boxes: List[Tuple[float, float, float, float]] = []
        norm_point_labels: List[bool] = []
        if points is not None and point_labels is not None and len(points) == len(point_labels):
            for (px, py), lab in zip(points, point_labels):
                # Build a 3x3 box centered at (px, py)
                x1p = max(0.0, px - 1.0); y1p = max(0.0, py - 1.0)
                x2p = min(W - 1.0, px + 1.0); y2p = min(H - 1.0, py + 1.0)
                cxp = ((x1p + x2p) * 0.5) / float(W)
                cyp = ((y1p + y2p) * 0.5) / float(H)
                wwp = max(1.0, (x2p - x1p)) / float(W)
                hhp = max(1.0, (y2p - y1p)) / float(H)
                norm_point_boxes.append((float(cxp), float(cyp), float(wwp), float(hhp)))
                norm_point_labels.append(bool(lab))

        for det in detections:
            x1, y1, x2, y2 = map(float, det["bbox"])

            # Normalized cx,cy,w,h in [0,1] for geometric prompt
            cx = ((x1 + x2) * 0.5) / float(W)
            cy = ((y1 + y2) * 0.5) / float(H)
            ww = (x2 - x1) / float(W)
            hh = (y2 - y1) / float(H)
            box_cxcywh = [float(cx), float(cy), float(ww), float(hh)]

            # Reset prompts, add detection box (positive), then any point boxes (pos/neg)
            with torch.inference_mode():
                self.processor.reset_all_prompts(self._state)  # type: ignore
                out = self.processor.add_geometric_prompt(     # type: ignore
                    state=self._state,
                    box=box_cxcywh,
                    label=True,
                )
                for (cxp, cyp, wwp, hhp), lab in zip(norm_point_boxes, norm_point_labels):
                    out = self.processor.add_geometric_prompt( # type: ignore
                        state=self._state,
                        box=[cxp, cyp, wwp, hhp],
                        label=bool(lab),
                    )

            # Extract masks from last call (reflecting all prompts added so far)
            masks = out.get("masks", [])
            if isinstance(masks, torch.Tensor):
                masks = masks.detach().cpu().numpy()
            masks = np.asarray(masks)

            # Normalize to list of 2D masks
            if masks.ndim == 2:
                masks_list = [masks]
            elif masks.ndim == 3:   # (K,H,W)
                masks_list = [masks[i] for i in range(masks.shape[0])]
            elif masks.ndim == 4:   # (K,1,H,W)
                masks_list = [masks[i, 0] for i in range(masks.shape[0])]
            else:
                masks_list = []

            # ROI limiter from bbox (+/- pad), clamped to image
            xi1 = int(max(0, np.floor(x1) - pad))
            yi1 = int(max(0, np.floor(y1) - pad))
            xi2 = int(min(W - 1, np.ceil(x2) + pad))
            yi2 = int(min(H - 1, np.ceil(y2) + pad))
            if xi2 <= xi1 or yi2 <= yi1:
                continue

            # Merge all masks for this bbox, constrained to ROI
            roi = np.s_[yi1:yi2 + 1, xi1:xi2 + 1]
            for m in masks_list:
                m_bin = (m > mask_threshold)
                unified[roi] |= m_bin[roi]

        return unified.astype(np.uint8) * 255

    @staticmethod
    def _nms(boxes: np.ndarray, scores: np.ndarray, iou_thresh: float) -> List[int]:
        b = torch.as_tensor(boxes, dtype=torch.float32)
        s = torch.as_tensor(scores, dtype=torch.float32)
        keep = ops.nms(b, s, float(iou_thresh))
        return keep.cpu().numpy().tolist()


if __name__ == "__main__":
    from torchvision.utils import draw_bounding_boxes, draw_segmentation_masks
    from torchvision.transforms.functional import to_pil_image

    image_path_ = "/root/capturestudio2/out/reconstructions/Aljosa_1_Perf_1/orbbec/cam08/color/1742051538059.jpg"
    img_bgr_ = cv2.imread(image_path_, cv2.IMREAD_COLOR)
    if img_bgr_ is None:
        raise SystemExit(f"Could not read image: {image_path_}")

    detector_ = Sam3Wrapper()

    dets = detector_.detect(img_bgr_, class_names=["person", "guitar", "mic"], min_confidence=0.6)
    mask_u8 = detector_.segment(
        img_bgr_,
        detections=dets,
        class_names=["person", "guitar", "microphone", "voice recorder"],
        min_confidence=0.3,
        mask_threshold=0.3,
    )

    # Convert image to RGB CHW uint8 tensor for torchvision drawing
    img_rgb = cv2.cvtColor(img_bgr_, cv2.COLOR_BGR2RGB)
    img_t = torch.from_numpy(img_rgb).permute(2, 0, 1).contiguous()  # [3,H,W], uint8

    # Overlay unified mask first (if any), then draw bounding boxes + labels
    has_mask = (mask_u8 > 0).any()
    if has_mask:
        mask_bool = torch.from_numpy(mask_u8 > 0)  # [H,W] bool
        canvas = draw_segmentation_masks(img_t, mask_bool, alpha=0.4, colors="red")
    else:
        canvas = img_t
    if len(dets) > 0:
        boxes = torch.tensor([d["bbox"] for d in dets], dtype=torch.float32)  # [N,4] xyxy
        labels = [f'{d["class_name"]} {d["confidence"]:.2f}' for d in dets]
        color_cycle = ["red", "orange", "yellow", "green", "cyan", "blue", "magenta", "pink"]
        colors = [color_cycle[int(d["class_id"]) % len(color_cycle)] for d in dets]

        canvas = draw_bounding_boxes(
            canvas,
            boxes,
            colors=colors,
            labels=labels,
            width=6,
            font_size=40,
            font="/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Bold.ttf",
        )
    to_pil_image(canvas).save("sam3_detections.png")

    detector_.reset()
