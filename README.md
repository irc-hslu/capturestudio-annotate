# HSLU CaptureStudio Annotate

**HSLU CaptureStudio Annotate** is a web‑based tool for annotating multi‑view
images captured by the [HSLU CaptureStudio](https://github.com/irc-hslu/capturestudio)
pipeline.  It provides a responsive
interface for drawing bounding boxes and placing positive/negative point
prompts on the first frame (or any selected frame) of each camera in a
session.  The tool leverages a Python FastAPI backend for heavy
computation (detection and segmentation) and a Next.js + React frontend
for an interactive user experience.

## Purpose and Features

* Annotate multi‑camera sessions: view a grid of camera frames from a
  CaptureStudio session and select frames for annotation.
* Draw **bounding boxes** and place **point prompts** (positive
  left‑click, negative right‑click) on images.  All boxes and points
  rotate correctly when the user rotates the image.
* Manage classes: add new class names with colours and select the
  active class for new boxes.
* **Segmentation overlay** powered by a SAM3 model.  When
  segmentation is computed, the overlay renders the background with a
  pink hue and leaves the foreground untouched.
* Rotate images (and annotations) by 90° CCW, 90° CW or 180°.
* JSON persistence: bounding boxes and points are saved as JSON files in
  `orbbec/camXX/mask/detections-<stem>.json`.  Masks are saved as
  `<stem>.jpg` in the same directories.
* FastAPI backend with endpoints for session discovery, image loading,
  detection, segmentation and mask retrieval.

If you encounter issues or have integration requests, feel free to
contact:

**Athanasios Charisoudis** <br>
Research Engineer at Immersive Realities Center <br> 
Hochschule Luzern
<athanasios.charisoudis@hslu.ch>

## Repository Layout

```
.
├── app/                       # Next.js app (frontend)
│   ├── (annotate)/annotate/   # Annotator pages
│   └── api/                   # Next.js API routes (image, detections, detect, segment, mask, session)
├── components/                # React components (grid, editor, sidebar, etc.)
├── python_backend/            # FastAPI backend and orchestration
│   ├── run.py                 # Launcher for backend + frontend
│   └── requirements.txt       # Python dependencies
├── store/                     # Zustand stores (editor, session, classes, detections)
├── types/                     # Shared TypeScript definitions
└── README.md                  # This file
```

## Installation

1. **Clone** the repository:

   ```bash
   git clone <repo-url> hslu-capturestudio-annotate
   cd hslu-capturestudio-annotate
   ```

2. **Install frontend dependencies** using
   [pnpm](https://pnpm.io/):

   ```bash
   pnpm install
   ```

3. **Install Python backend dependencies** in a virtual environment
   (we use `uv` package manager so make sure it is installed system-wide):

   ```bash
   cd python_backend
   uv sync
   # Activate the virtual environment
   source .venv/bin/activate  # on Linux/macOS
   # .venv\Scripts\activate   # on Windows
   ```

## Running the Application

### Using the launcher

The provided `python_backend/run.py` script starts both the FastAPI
backend and the Next.js frontend.  It simplifies development by
automatically wiring the endpoints and passing the session path to the
frontend.

```bash
cd python_backend
source .venv/bin/activate

python run.py \
  --session "/abs/path/to/CaptureStudio/session" \
  --frontend-dir .. \
  --frontend-mode dev \
  --open
```

Options:

* `--session` (required): absolute path to a CaptureStudio session.  A
  session is expected to contain `orbbec/camXX/color/*.jpg` folders.
* `--frontend-dir`: location of the Next.js project (default is
  `..`).
* `--frontend-mode`: `dev` runs `next dev` for hot reload; `prod`
  runs the compiled `next start` server.
* `--open`: automatically open the browser when both servers are
  running.

The launcher uses environment variables `BACKEND_PORT` (default
`8060`) and `ALLOWED_ORIGINS` (default
`http://localhost:3000,http://127.0.0.1:3000`) for backend CORS
configuration.

### Running services separately

Alternatively, you can start the frontend and backend separately.

1. **Frontend**:

   ```bash
   pnpm dev  # serves at http://localhost:3000
   ```

2. **Backend**:

   ```bash
   cd python_backend
   source .venv/bin/activate
   uvicorn app:app --host 127.0.0.1 --port 8060
   ```

Open `http://localhost:3000/` in your browser.

For a production build:

```bash
# Frontend
pnpm build
pnpm start

# Backend
uvicorn app:app --host 0.0.0.0 --port 8060
```

## Usage

1. Visit `/` and enter the absolute session path.  The session must
   contain `orbbec/camXX/color` folders with images.  Alternatively,
   set the environment variable `NEXT_PUBLIC_SESSION_PATH` to a
   session path; the home page will automatically redirect to the
   annotator.

2. The **Camera Grid** displays the first frame from each camera.  Click a
   tile to open the editor.  The timeline at the bottom allows you to
   add frames at relative offsets.

3. Use the **toolbar** to choose between **BBox**, **Points**,
   **Select** and **Pan** modes; rotate images; and run detection via
   your configured detector.  The current rotation is passed to the
   backend so that detection and segmentation operate on the rotated
   view.

4. To add bounding boxes, select the **BBox** tool and drag on the
   image.  To add points, select **Points** and left‑click (positive)
   or right‑click (negative).  All points for a given image/time step
   are stored in a single entry.

5. Use **Select** mode to adjust boxes.  Resizing or dragging a box
   updates the JSON and invalidates any existing mask.

6. To compute a segmentation mask, click **Apply (Segment)**.  The
   current boxes and points are sent to the backend.  If
   successful, the mask is stored next to the detections file and
   loaded on the next annotation session.  Use the **Show Mask** switch
   to toggle the overlay on and off.

## API Overview

The backend exposes several endpoints under `/api` (prefix implied by
Next.js).  The Python FastAPI server runs at `/` and proxies to
`/python_backend` within the code:

* **`POST /api/session`** — Validates a session path and enumerates
  cameras and their frames.
* **`GET /api/image`** — Streams a colour image for a given camera and
  time index (`t`).  Rotation is applied client‑side.
* **`GET /api/detections/get`** — Loads or initializes the JSON
  detections file for a given camera and stem.
* **`POST /api/detections/upsert`** — Adds or updates a detection item
  (box or points).  Automatically writes the JSON file.
* **`POST /api/detections/delete`** — Deletes a detection by index.
* **`POST /api/detect`** — Runs the configured detector (e.g. YOLO,
  SAM3) on the rotated frame and returns bounding boxes.  The default
  implementation is a stub; integrate your own model.
* **`POST /api/segment`** — Runs your SAM2/SAM3 segmentor on the
  rotated frame using current boxes and points.  Returns a mask as
  base64 and writes it to disk.
* **`GET /api/mask/get`** — Retrieves a mask image (JPEG) if it
  exists.

Custom detectors or segmentors can be integrated in
`python_backend/app/inference/detector.py` and
`python_backend/app/inference/segmentor.py`.  The default implementation
provides examples for YOLO‑v3/4 and SAM‑3 models.  You can swap in
your own model by editing these files.

## Python Backend Requirements

Python dependencies are listed in `python_backend/requirements.txt`.
Key packages:

* **fastapi** — web framework for the API
* **uvicorn** — ASGI server
* **pydantic** — request/response models
* **numpy**, **Pillow** — image manipulation
* **opencv-python-headless** — image I/O and rotation
* **torch**, **sam3** — we are using SAM3 for detection

Install them with `pip install -r requirements.txt` inside a virtual
environment.  Additional model weights (YOLO, SAM) should be stored in
`python_backend/app/inference/checkpoints`.

## Next.js Frontend Requirements

The frontend uses modern dependencies:

* **Next.js** 15
* **React** 19
* **react-konva** 19 — canvas drawing for boxes and points
* **Tailwind CSS** — styling framework
* **shadcn/ui** — UI primitives
* **zustand** — state management
* **pnpm** — package manager

Install them with `pnpm install` at the root of the repository.

## Contributing & Support

This tool was developed for internal use at the Hochschule Luzern
CaptureStudio project.  For bug reports, feature requests or
integration support, please contact **Athanasios Charisoudis** at
<athanasios.charisoudis@hslu.ch>.  Contributions are welcome via
pull requests.
