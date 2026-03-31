#!/bin/bash
cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display alert "未找到 Python 3" message "请先安装 Python 3，再重新打开这个工具。"' >/dev/null 2>&1
  exit 1
fi

(sleep 1.2; open "http://127.0.0.1:8765/") &
exec python3 serve_helper.py --no-open "$@"
