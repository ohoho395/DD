#!/bin/bash
cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display alert "未找到 Python 3" message "请先安装 Python 3，再重新运行同步。"' >/dev/null 2>&1
  exit 1
fi

exec python3 sync_paldb.py "$@"
