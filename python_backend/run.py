"""
One-shot launcher: starts FastAPI backend and Next.js frontend together.

Examples:
  python run.py --session /data/session-A --frontend-dir ../ --frontend-mode dev
  python run.py --session /data/session-A --frontend-dir ../ --frontend-mode start --build
"""

import argparse
import os
import subprocess
import sys
import time
import signal
import threading
import webbrowser

import uvicorn


def start_next(frontend_dir: str, port: int, backend_url: str, session_path: str, mode: str = 'dev', build: bool = False):
    env = os.environ.copy()
    env["PORT"] = str(port)
    env["PY_BACKEND_URL"] = backend_url
    env["SESSION_PATH"] = session_path

    if mode == "dev":
        cmd = ["npm", "run", "dev"]
    elif mode == "start":
        if build:
            # ensure build before start
            subprocess.run(["npm", "run", "build"], cwd=frontend_dir, env=env, check=True)
        cmd = ["npm", "run", "start"]
    else:
        raise ValueError("--frontend-mode must be 'dev' or 'start'")

    return subprocess.Popen(cmd, cwd=frontend_dir, env=env, stdout=sys.stdout, stderr=sys.stderr)


def start_backend(host: str, port: int):
    config = uvicorn.Config("app.main:app", host=host, port=port, reload=False, log_level="info")
    server = uvicorn.Server(config)
    server.run()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", required=True, help="Absolute path to the session root")
    parser.add_argument("--backend-host", default="127.0.0.1", help="Backend bind host")
    parser.add_argument("--backend-port", type=int, default=8060, help="Backend port")
    parser.add_argument("--frontend-dir", default='../', help="Path to Next.js app root")
    parser.add_argument("--frontend-port", type=int, default=3001, help="Next.js port")
    parser.add_argument("--frontend-mode", choices=["dev", "start"], default="dev")
    parser.add_argument("--build", action="store_true", help="Build Next app before start (only for mode 'start')")
    parser.add_argument("--open", action="store_true", help="Open browser at frontend URL")
    args = parser.parse_args()

    session_path = os.path.abspath(args.session)
    if not os.path.isdir(session_path):
        print(f"[launcher] Session path does not exist: {session_path}", file=sys.stderr)
        sys.exit(2)

    backend_url = f"http://{args.backend_host}:{args.backend_port}"

    # Launch Next.js
    print("[launcher] Starting Next.js…")
    next_proc = start_next(
        frontend_dir=os.path.abspath(args.frontend_dir),
        port=args.frontend_port,
        backend_url=backend_url,
        session_path=session_path,
        mode=args.frontend_mode,
        build=args.build,
    )
    time.sleep(2.0)

    # Start FastAPI in the main thread (so Ctrl+C stops it)
    print("[launcher] Starting FastAPI…")
    backend_thread = threading.Thread(
        target=start_backend, args=(args.backend_host, args.backend_port), daemon=True
    )
    backend_thread.start()

    url = f"http://127.0.0.1:{args.frontend_port}/annotate?session={session_path}"
    if args.open:
        # wait a bit and open
        time.sleep(2.5)
        try:
            webbrowser.open(url)
        except Exception:
            print("[launcher] Failed to open browser automatically.", file=sys.stderr)
            print('[launcher] Please open your browser at:', url, file=sys.stderr)
            pass

    def handle_sig(sig, frame):
        print("\n[launcher] Shutting down…")
        try:
            if next_proc and next_proc.poll() is None:
                next_proc.terminate()
                try:
                    next_proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    next_proc.kill()
        finally:
            os._exit(0)

    signal.signal(signal.SIGINT, handle_sig)
    signal.signal(signal.SIGTERM, handle_sig)

    # keep alive
    while True:
        time.sleep(1.0)
        if next_proc.poll() is not None:
            print("[launcher] Next.js process exited; stopping backend.")
            os._exit(next_proc.returncode or 0)


if __name__ == "__main__":
    main()