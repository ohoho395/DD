from __future__ import annotations

import os
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path


def resolve_project_dir() -> Path:
    if getattr(sys, "frozen", False):
        candidates = []
        meipass = getattr(sys, "_MEIPASS", "")
        if meipass:
            candidates.append(Path(meipass) / "bundle")

        exe_path = Path(sys.executable).resolve()
        candidates.extend(
            [
                exe_path.parent / "bundle",
                exe_path.parent / ".." / "Resources" / "bundle",
                exe_path.parent.parent / "Resources" / "bundle",
            ]
        )

        for candidate in candidates:
            candidate = candidate.expanduser().resolve()
            if candidate.exists():
                return candidate

    return Path(__file__).resolve().parent


def resolve_log_path(project_dir: Path) -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent / "launcher.log"
    return project_dir / "launcher.log"


def resolve_runtime_dir(project_dir: Path) -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return project_dir


def write_launch_log(log_path: Path, message: str) -> None:
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(f"[{timestamp}] {message}\n")


def wait_for_server(url: str, log_path: Path, timeout_seconds: float = 18.0) -> bool:
    deadline = time.time() + timeout_seconds
    host = "127.0.0.1"
    port = 8765
    request_bytes = (
        b"GET /api/status HTTP/1.1\r\n"
        b"Host: 127.0.0.1:8765\r\n"
        b"Connection: close\r\n\r\n"
    )
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1.2) as sock:
                sock.sendall(request_bytes)
                payload = sock.recv(128)
            if b" 200 " in payload:
                write_launch_log(log_path, f"server ready: {url.rstrip('/')}/api/status")
                return True
        except Exception as exc:
            write_launch_log(log_path, f"server wait retry: {exc!r}")
            time.sleep(0.35)
    write_launch_log(log_path, f"server readiness timed out: {url.rstrip('/')}/api/status")
    return False


def open_browser_when_ready(url: str, log_path: Path) -> None:
    wait_for_server(url, log_path)
    webbrowser.open(url)
    write_launch_log(log_path, f"browser opened: {url}")


def main(argv: list[str] | None = None) -> int:
    argv = argv or []
    project_dir = resolve_project_dir()
    runtime_dir = resolve_runtime_dir(project_dir)
    log_path = resolve_log_path(project_dir)
    os.environ["PALWORLD_HELPER_PROJECT_DIR"] = str(project_dir)
    os.environ["PALWORLD_HELPER_RUNTIME_DIR"] = str(runtime_dir)
    os.chdir(project_dir)
    write_launch_log(log_path, f"launch start, project_dir={project_dir}")
    write_launch_log(log_path, f"runtime_dir={runtime_dir}")

    try:
        import serve_helper

        url = f"http://{serve_helper.HOST}:{serve_helper.DEFAULT_PORT}/"
        threading.Thread(target=open_browser_when_ready, args=(url, log_path), daemon=True).start()
        exit_code = serve_helper.main(["--no-open", *argv])
        write_launch_log(log_path, f"launch exit code={exit_code}")
        return exit_code
    except Exception as exc:  # pragma: no cover - defensive logging for packaged app startup
        write_launch_log(log_path, f"fatal startup error: {exc!r}")
        raise


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
