#!/bin/bash
cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display alert "未找到 Python 3" message "请先安装 Python 3，再重新构建 .app。"' >/dev/null 2>&1
  exit 1
fi

python3 -m pip install --user pyinstaller pillow
exec python3 build_native.py
