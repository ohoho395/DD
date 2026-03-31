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


def build_status_request(host: str, port: int) -> bytes:
    return (
        f"GET /api/ping HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        f"Connection: close\r\n\r\n"
    ).encode("ascii")


def probe_status(host: str, port: int, timeout_seconds: float = 1.2) -> tuple[bool, str]:
    try:
        with socket.create_connection((host, port), timeout=timeout_seconds) as sock:
            sock.sendall(build_status_request(host, port))
            payload = sock.recv(160)
    except Exception as exc:
        return False, repr(exc)

    preview = payload.decode("latin-1", errors="replace").replace("\r", "\\r").replace("\n", "\\n")
    return b" 200 " in payload, preview[:140]


def reserve_preferred_port(host: str, port: int) -> bool:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind((host, port))
        return True
    except OSError:
        return False
    finally:
        sock.close()


def choose_port(host: str, preferred_port: int, log_path: Path) -> int:
    ready, preview = probe_status(host, preferred_port, timeout_seconds=0.5)
    if ready:
        write_launch_log(log_path, f"reusing helper on {host}:{preferred_port}")
        return preferred_port

    if reserve_preferred_port(host, preferred_port):
        write_launch_log(log_path, f"using preferred port {preferred_port}")
        return preferred_port

    if preview:
        write_launch_log(log_path, f"preferred port {preferred_port} is occupied: {preview}")

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((host, 0))
        port = sock.getsockname()[1]

    write_launch_log(log_path, f"fallback port selected: {port}")
    return port


def wait_for_server(url: str, host: str, port: int, log_path: Path, timeout_seconds: float = 18.0) -> bool:
    deadline = time.time() + timeout_seconds
    last_preview = ""
    last_log_at = 0.0
    while time.time() < deadline:
        ready, preview = probe_status(host, port)
        if ready:
            write_launch_log(log_path, f"server ready: {url.rstrip('/')}/api/ping")
            return True

        now = time.time()
        if preview != last_preview or now - last_log_at >= 2.0:
            write_launch_log(log_path, f"server wait retry: {preview}")
            last_preview = preview
            last_log_at = now
        time.sleep(0.35)
    write_launch_log(log_path, f"server readiness timed out: {url.rstrip('/')}/api/ping")
    return False


def open_browser_when_ready(url: str, host: str, port: int, log_path: Path) -> None:
    wait_for_server(url, host, port, log_path)
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

        host = serve_helper.HOST
        port = choose_port(host, serve_helper.DEFAULT_PORT, log_path)
        url = f"http://{host}:{port}/"
        write_launch_log(log_path, f"target url={url}")
        threading.Thread(target=open_browser_when_ready, args=(url, host, port, log_path), daemon=True).start()
        exit_code = serve_helper.main(["--no-open", "--port", str(port), *argv])
        write_launch_log(log_path, f"launch exit code={exit_code}")
        return exit_code
    except Exception as exc:  # pragma: no cover - defensive logging for packaged app startup
        write_launch_log(log_path, f"fatal startup error: {exc!r}")
        raise


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
