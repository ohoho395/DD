from __future__ import annotations

import os
import sys
import threading
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


def main(argv: list[str] | None = None) -> int:
    argv = argv or []
    project_dir = resolve_project_dir()
    os.environ["PALWORLD_HELPER_PROJECT_DIR"] = str(project_dir)
    os.chdir(project_dir)

    import serve_helper

    url = f"http://{serve_helper.HOST}:{serve_helper.DEFAULT_PORT}/"
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    return serve_helper.main(["--no-open", *argv])


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
