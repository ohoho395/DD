from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import sys
import threading
import time
import traceback
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


def resolve_project_dir() -> Path:
    override = os.environ.get("PALWORLD_HELPER_PROJECT_DIR")
    if override:
        return Path(override).expanduser().resolve()
    return Path(__file__).resolve().parent


PROJECT_DIR = resolve_project_dir()
RUNTIME_DIR = Path(os.environ.get("PALWORLD_HELPER_RUNTIME_DIR", str(PROJECT_DIR))).expanduser().resolve()
SYNC_DATA_PATH = PROJECT_DIR / "paldb-sync.json"
SYNC_LOG_PATH = PROJECT_DIR / "sync.log"
SERVICE_LOG_PATH = RUNTIME_DIR / "service.log"
HOST = "127.0.0.1"
DEFAULT_PORT = 8765
RANKING_STAGE_TOTAL = 12
DETAIL_PROGRESS_RE = re.compile(r"^\[sync\]\s+(\d+)/(\d+)\b", re.M)
MAP_TILE_RE = re.compile(r"^\[done\]\s+map tiles refreshed:\s+(\d+)", re.M)
STAGE_DEFS = [
    ("boot", "准备启动"),
    ("index", "图鉴索引"),
    ("rankings", "岗位榜单"),
    ("details", "帕鲁详情"),
    ("maps", "本地地图"),
    ("outputs", "写入缓存"),
]


class SyncRuntime:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.worker_thread: threading.Thread | None = None
        self.last_exit_code: int | None = None

    def status(self) -> dict:
        try:
            with self.lock:
                syncing = self.worker_thread is not None and self.worker_thread.is_alive()
                last_exit_code = self.last_exit_code

            synced_at = None
            if SYNC_DATA_PATH.exists():
                try:
                    payload = json.loads(SYNC_DATA_PATH.read_text(encoding="utf-8"))
                    if isinstance(payload, dict):
                        meta = payload.get("meta") or {}
                        if isinstance(meta, dict):
                            synced_at = meta.get("syncedAt")
                except json.JSONDecodeError:
                    synced_at = None

            log_text = read_log_text()

            return {
                "syncing": syncing,
                "lastExitCode": last_exit_code,
                "syncedAt": synced_at,
                "logTail": read_log_tail(log_text),
                "progress": build_sync_progress(log_text, syncing, last_exit_code, synced_at),
            }
        except Exception as exc:  # pragma: no cover - defensive runtime fallback for packaged app
            write_service_log(f"status() failed: {exc!r}")
            write_service_log(traceback.format_exc().rstrip())
            fallback_log = read_log_text() if SYNC_LOG_PATH.exists() else ""
            return {
                "syncing": False,
                "lastExitCode": None,
                "syncedAt": None,
                "logTail": read_log_tail(fallback_log),
                "progress": {
                    "overall": 0.0,
                    "summary": "同步服务已连接，但状态读取失败，请看 service.log",
                    "currentStage": "",
                    "stages": [],
                },
            }

    def start_sync(self) -> dict:
        with self.lock:
            if self.worker_thread is not None and self.worker_thread.is_alive():
                return self.status()

            SYNC_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            SYNC_LOG_PATH.write_text("", encoding="utf-8")
            self.last_exit_code = None
            worker = threading.Thread(target=self._run_sync_job, daemon=True)
            self.worker_thread = worker

        worker.start()
        return self.status()

    def _run_sync_job(self) -> None:
        exit_code = 1
        try:
            with SYNC_LOG_PATH.open("w", encoding="utf-8", buffering=1) as log_handle:
                with contextlib.redirect_stdout(log_handle), contextlib.redirect_stderr(log_handle):
                    try:
                        import sync_paldb

                        exit_code = sync_paldb.main(["--reuse-cache"])
                    except SystemExit as exc:
                        code = exc.code
                        exit_code = code if isinstance(code, int) else 1
                    except Exception as exc:  # pragma: no cover - defensive guard
                        print(f"[error] {exc}", file=sys.stderr, flush=True)
                        exit_code = 1
        except Exception:
            exit_code = 1

        with self.lock:
            self.worker_thread = None
            self.last_exit_code = exit_code


def read_log_text() -> str:
    if not SYNC_LOG_PATH.exists():
        return ""
    return SYNC_LOG_PATH.read_text(encoding="utf-8", errors="replace")


def write_service_log(message: str) -> None:
    timestamp = threading.current_thread().name
    SERVICE_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with SERVICE_LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(f"[{time_stamp()}][{timestamp}] {message}\n")


def time_stamp() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")


def read_log_tail(log_text: str, line_limit: int = 28) -> str:
    if not log_text:
        return ""
    lines = log_text.splitlines()
    return "\n".join(lines[-line_limit:])


def build_sync_progress(log_text: str, syncing: bool, last_exit_code: int | None, synced_at: str | None) -> dict:
    stages = {
        key: {
            "id": key,
            "label": label,
            "status": "pending",
            "progress": 0.0,
            "detail": "",
        }
        for key, label in STAGE_DEFS
    }

    def set_stage(stage_id: str, status: str, progress: float, detail: str = "") -> None:
        stage = stages[stage_id]
        stage["status"] = status
        stage["progress"] = max(0.0, min(progress, 1.0))
        if detail:
            stage["detail"] = detail

    def has(token: str) -> bool:
        return token in log_text

    if not log_text:
        if syncing:
            set_stage("boot", "active", 0.12, "同步脚本已启动，等待第一批日志")
        summary = "等待同步启动" if not syncing else "正在连接数据源"
        return {
            "overall": 0.02 if syncing else 0.0,
            "summary": summary,
            "currentStage": "boot" if syncing else "",
            "stages": list(stages.values()),
        }

    has_index = has("[stage] 读取帕鲁索引")
    has_rankings = has("[stage] 读取岗位榜单")
    has_details = has("[stage] 读取帕鲁详情")
    has_map_config = has("[stage] 读取地图配置与点位分布")
    has_map_tiles = has("[stage] 生成本地地图瓦片缓存")
    has_outputs = has("[stage] 写入本地缓存")
    has_output_writes = "[done] wrote" in log_text and "synced-data.js" in log_text and "paldb-sync.json" in log_text
    has_done = (
        has("[done] 同步流程完成")
        or (not syncing and last_exit_code == 0 and bool(synced_at))
        or (not syncing and bool(synced_at) and has_output_writes)
    )

    set_stage(
        "boot",
        "completed" if has_index or has_done else "active",
        1.0 if has_index or has_done else 0.35,
        "同步脚本已启动",
    )

    if has_index:
        set_stage(
            "index",
            "completed" if has_rankings or has_done else "active",
            1.0 if has_rankings or has_done else 0.7,
            "正在整理图鉴索引与基础信息",
        )

    ranking_count = len(re.findall(r"^\[rank\]\s+", log_text, re.M))
    if has_rankings:
        ranking_progress = min(1.0, ranking_count / RANKING_STAGE_TOTAL) if ranking_count else 0.08
        set_stage(
            "rankings",
            "completed" if has_details or has_done else "active",
            1.0 if has_details or has_done else ranking_progress,
            f"已处理 {ranking_count}/{RANKING_STAGE_TOTAL} 个岗位榜单",
        )

    detail_matches = list(DETAIL_PROGRESS_RE.finditer(log_text))
    if has_details:
        if detail_matches:
            current = detail_matches[-1]
            current_index = int(current.group(1))
            total = int(current.group(2))
            progress = current_index / total if total else 0.0
            detail = f"已抓取 {current_index}/{total} 只帕鲁详情"
        else:
            progress = 0.04
            detail = "正在读取帕鲁详情页"
        set_stage(
            "details",
            "completed" if has_map_config or has_map_tiles or has_outputs or has_done else "active",
            1.0 if has_map_config or has_map_tiles or has_outputs or has_done else progress,
            detail,
        )

    if has_map_config or has_map_tiles:
        tile_match = MAP_TILE_RE.search(log_text)
        map_progress = 0.25 if has_map_config else 0.0
        detail = "正在读取地图点位配置"
        if has_map_tiles:
            map_progress = 0.72
            detail = "正在生成和替换本地地图文件"
        if tile_match:
            map_progress = 1.0 if has_outputs or has_done else 0.92
            detail = f"本轮地图文件已刷新 {tile_match.group(1)} 张瓦片"
        set_stage(
            "maps",
            "completed" if has_outputs or has_done else "active",
            1.0 if has_outputs or has_done else map_progress,
            detail,
        )

    if has_outputs:
        output_progress = 0.35
        detail = "正在写入本地缓存文件"
        wrote_count = len(re.findall(r"^\[done\]\s+wrote\s+", log_text, re.M))
        if wrote_count >= 2:
            output_progress = 0.92
            detail = "图鉴缓存已写入，正在收尾"
        set_stage(
            "outputs",
            "completed" if has_done else "active",
            1.0 if has_done else output_progress,
            detail,
        )

    has_failed = not syncing and last_exit_code not in (None, 0) and not has_done

    if has_done:
        for stage_id in stages:
            if stages[stage_id]["status"] == "pending":
                set_stage(stage_id, "completed", 1.0)
            else:
                stages[stage_id]["status"] = "completed"
                stages[stage_id]["progress"] = 1.0
        summary = "同步完成，本地缓存已更新"
        current_stage = "outputs"
    elif has_failed:
        failed_stage = next(
            (stage for stage in reversed(list(stages.values())) if stage["status"] in {"active", "completed"}),
            stages["boot"],
        )
        failed_stage["status"] = "failed"
        failed_stage["progress"] = max(0.18, failed_stage["progress"])
        failed_stage["detail"] = failed_stage["detail"] or "请看日志确认具体报错"
        summary = f"同步在“{failed_stage['label']}”阶段中断，请看下方日志"
        current_stage = failed_stage["id"]
    else:
        active_stage = next((stage["id"] for stage in stages.values() if stage["status"] == "active"), "")
        current_stage = active_stage
        if active_stage:
            summary = stages[active_stage]["detail"] or f"正在处理 {stages[active_stage]['label']}"
        else:
            summary = "等待下一步同步"

    overall = sum(stage["progress"] for stage in stages.values()) / len(stages)
    return {
        "overall": overall,
        "summary": summary,
        "currentStage": current_stage,
        "stages": list(stages.values()),
    }


RUNTIME = SyncRuntime()


class HelperHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_DIR), **kwargs)

    def do_GET(self) -> None:
        try:
            parsed = urlparse(self.path)
            if parsed.path == "/api/ping":
                self._send_json({"ok": True, "projectDir": str(PROJECT_DIR)})
                return
            if parsed.path == "/api/status":
                self._send_json(RUNTIME.status())
                return
            super().do_GET()
        except Exception as exc:  # pragma: no cover - defensive runtime fallback
            write_service_log(f"GET {self.path} failed: {exc!r}")
            write_service_log(traceback.format_exc().rstrip())
            self._send_json({"ok": False, "error": repr(exc)}, status=HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_POST(self) -> None:
        try:
            parsed = urlparse(self.path)
            if parsed.path == "/api/sync":
                self._send_json(RUNTIME.start_sync(), status=HTTPStatus.ACCEPTED)
                return
            self.send_error(HTTPStatus.NOT_FOUND)
        except Exception as exc:  # pragma: no cover - defensive runtime fallback
            write_service_log(f"POST {self.path} failed: {exc!r}")
            write_service_log(traceback.format_exc().rstrip())
            self._send_json({"ok": False, "error": repr(exc)}, status=HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def end_headers(self) -> None:
        origin = self.headers.get("Origin")
        self.send_header("Cache-Control", "no-store, max-age=0, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", origin if origin and origin != "null" else "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Vary", "Origin, Access-Control-Request-Private-Network")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        return

    def _send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the Palworld helper with a clickable sync API.")
    parser.add_argument("--host", default=HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--no-open", action="store_true", help="Do not automatically open a browser window.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    url = f"http://{args.host}:{args.port}/"
    write_service_log(f"serve start host={args.host} port={args.port} project_dir={PROJECT_DIR} runtime_dir={RUNTIME_DIR}")
    try:
        server = ThreadingHTTPServer((args.host, args.port), HelperHandler)
    except OSError as exc:
        if exc.errno in {48, 98, 10048}:
            write_service_log(f"serve bind reused existing listener at {url}: {exc!r}")
            print(f"[serve] already running at {url}")
            if not args.no_open:
                threading.Timer(0.2, lambda: webbrowser.open(url)).start()
            return 0
        raise
    print(f"[serve] {url}")
    if not args.no_open:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[serve] stopped")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
