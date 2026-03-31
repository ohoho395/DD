# 原生打包说明

## 当前状态

- 仓库已经带好 macOS / Windows 双平台的原生构建脚本
- GitHub Actions 会在 `main` 分支推送或手动触发时同时构建两个平台
- 本地也可以手动跑同一套脚本

## macOS 构建

直接双击：

- `build_macos_app.command`

产物会在：

- `dist-native/PalworldDexHelper.app`
- `dist-native/PalworldDexHelper.zip`

## Windows 构建

把整个项目目录拷到 Windows 电脑后，双击：

- `build_windows_exe.bat`

产物会在：

- `dist-native/PalworldDexHelper/`
- `dist-native/PalworldDexHelper.zip`

## 构建依赖

脚本会自动安装：

- `pyinstaller`
- `pillow`

## GitHub Actions 产物

工作流名：

- `Build Native Desktop Packages`

构建完成后会上传：

- `PalworldDexHelper-macOS-native`
- `PalworldDexHelper-Windows-native`
