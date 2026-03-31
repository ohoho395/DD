from __future__ import annotations

import os
import sys
import threading
import time
import urllib.request
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


def write_launch_log(log_path: Path, message: str) -> None:
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(f"[{timestamp}] {message}\n")


def wait_for_server(url: str, log_path: Path, timeout_seconds: float = 18.0) -> bool:
    deadline = time.time() + timeout_seconds
    status_url = url.rstrip("/") + "/api/status"
    request = urllib.request.Request(status_url, headers={"User-Agent": "PalworldDexHelper"})
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(request, timeout=1.2) as response:
                if 200 <= response.status < 300:
                    write_launch_log(log_path, f"server ready: {status_url}")
                    return True
        except Exception:
            time.sleep(0.35)
    write_launch_log(log_path, f"server readiness timed out: {status_url}")
    return False


def open_browser_when_ready(url: str, log_path: Path) -> None:
    wait_for_server(url, log_path)
    webbrowser.open(url)
    write_launch_log(log_path, f"browser opened: {url}")


def main(argv: list[str] | None = None) -> int:
    argv = argv or []
    project_dir = resolve_project_dir()
    log_path = resolve_log_path(project_dir)
    os.environ["PALWORLD_HELPER_PROJECT_DIR"] = str(project_dir)
    os.chdir(project_dir)
    write_launch_log(log_path, f"launch start, project_dir={project_dir}")

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
