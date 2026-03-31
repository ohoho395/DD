from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
import PyInstaller.__main__


PROJECT_DIR = Path(__file__).resolve().parent
BUILD_DIR = PROJECT_DIR / "native-build"
ICON_DIR = BUILD_DIR / "icons"
DEFAULTS_DIR = BUILD_DIR / "defaults"
DIST_DIR = PROJECT_DIR / "dist-native"
WORK_DIR = BUILD_DIR / "work"
SPEC_DIR = BUILD_DIR / "spec"
APP_NAME = "PalworldDexHelper"
ICON_SOURCE = PROJECT_DIR / "assets" / "pals" / "100.png"
APP_ICON_PNG = ICON_DIR / "app-icon.png"
APP_ICON_ICO = ICON_DIR / "app-icon.ico"
APP_ICON_ICNS = ICON_DIR / "app-icon.icns"


def ensure_clean_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def make_base_icon() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    for index, color in enumerate([(15, 116, 103, 255), (29, 77, 104, 255), (188, 125, 47, 255)]):
        inset = 28 + index * 18
        draw.rounded_rectangle(
            (inset, inset, 1024 - inset, 1024 - inset),
            radius=220 - index * 28,
            fill=color,
        )

    glow = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((120, 100, 920, 760), fill=(255, 255, 255, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(48))
    canvas.alpha_composite(glow)

    if ICON_SOURCE.exists():
        base = Image.open(ICON_SOURCE).convert("RGBA")
        shadow = base.resize((640, 640), Image.Resampling.LANCZOS)
        shadow = shadow.filter(ImageFilter.GaussianBlur(14))
        shadow_layer = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
        shadow_layer.alpha_composite(shadow, dest=(192, 248))
        shadow_layer = shadow_layer.point(lambda value: int(value * 0.38))
        canvas.alpha_composite(shadow_layer)

        mascot = base.resize((620, 620), Image.Resampling.LANCZOS)
        canvas.alpha_composite(mascot, dest=(202, 188))
    else:
        draw.ellipse((224, 214, 800, 790), fill=(245, 249, 248, 240))
        draw.ellipse((314, 336, 476, 498), fill=(15, 116, 103, 255))
        draw.ellipse((548, 336, 710, 498), fill=(29, 77, 104, 255))
        draw.rounded_rectangle((352, 532, 672, 628), radius=48, fill=(188, 125, 47, 255))
        draw.rounded_rectangle((412, 668, 612, 736), radius=34, fill=(255, 255, 255, 228))

    highlight = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight)
    highlight_draw.rounded_rectangle((74, 74, 950, 950), radius=200, outline=(255, 255, 255, 90), width=10)
    canvas.alpha_composite(highlight)

    canvas.save(APP_ICON_PNG)
    canvas.save(APP_ICON_ICO, sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])


def make_icns() -> None:
    if sys.platform != "darwin":
        return

    iconset_dir = ICON_DIR / "app.iconset"
    ensure_clean_dir(iconset_dir)

    sizes = [
        (16, "icon_16x16.png"),
        (32, "icon_16x16@2x.png"),
        (32, "icon_32x32.png"),
        (64, "icon_32x32@2x.png"),
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"),
        (512, "icon_256x256@2x.png"),
        (512, "icon_512x512.png"),
        (1024, "icon_512x512@2x.png"),
    ]

    source = Image.open(APP_ICON_PNG).convert("RGBA")
    for size, filename in sizes:
        resized = source.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(iconset_dir / filename)

    subprocess.run(["iconutil", "-c", "icns", str(iconset_dir), "-o", str(APP_ICON_ICNS)], check=True)


def ensure_runtime_stub(relative_path: str, content: str) -> Path:
    target = PROJECT_DIR / relative_path
    if target.exists():
        return target
    stub_path = DEFAULTS_DIR / relative_path
    stub_path.parent.mkdir(parents=True, exist_ok=True)
    stub_path.write_text(content, encoding="utf-8")
    return stub_path


def build_args() -> list[str]:
    separator = ";" if sys.platform.startswith("win") else ":"

    def add_data(path: Path, target: str) -> str:
        return f"{path}{separator}{target}"

    def include_file(args: list[str], path: Path, target: str) -> None:
        if path.exists():
            args.extend(["--add-data", add_data(path, target)])

    def include_optional_dir(args: list[str], path: Path, target: str) -> None:
        if path.exists() and any(path.rglob("*")):
            args.extend(["--add-data", add_data(path, target)])

    args = [
        "--noconfirm",
        "--clean",
        "--name",
        APP_NAME,
        "--distpath",
        str(DIST_DIR),
        "--workpath",
        str(WORK_DIR),
        "--specpath",
        str(SPEC_DIR),
        "--windowed",
        "--hidden-import",
        "serve_helper",
        "--hidden-import",
        "sync_paldb",
        str(PROJECT_DIR / "desktop_launcher.py"),
    ]

    include_file(args, PROJECT_DIR / "index.html", "bundle")
    include_file(args, PROJECT_DIR / "local-map-viewer.html", "bundle")
    include_file(args, PROJECT_DIR / "styles.css", "bundle")
    include_file(args, PROJECT_DIR / "app.js", "bundle")
    include_file(args, PROJECT_DIR / "data.js", "bundle")
    include_file(
        args,
        ensure_runtime_stub("synced-data.js", "window.PALWORLD_SYNC_DATA = {};\n"),
        "bundle",
    )
    include_file(
        args,
        ensure_runtime_stub("paldb-sync.json", "{\n  \"meta\": null,\n  \"pals\": {},\n  \"jobRankings\": {}\n}\n"),
        "bundle",
    )
    include_file(
        args,
        ensure_runtime_stub("generated/pal-map-data.js", "window.PALWORLD_LOCAL_MAPS = null;\n"),
        "bundle/generated",
    )
    include_optional_dir(args, PROJECT_DIR / "assets", "bundle/assets")
    include_optional_dir(args, PROJECT_DIR / "generated" / "map-tiles", "bundle/generated/map-tiles")
    include_optional_dir(args, PROJECT_DIR / "vendor", "bundle/vendor")

    if sys.platform == "darwin" and APP_ICON_ICNS.exists():
        args.extend(["--icon", str(APP_ICON_ICNS), "--osx-bundle-identifier", "local.palworld.dex.helper"])
    elif APP_ICON_ICO.exists():
        args.extend(["--icon", str(APP_ICON_ICO)])

    return args


def package_outputs() -> list[Path]:
    outputs: list[Path] = []
    if sys.platform == "darwin":
        app_path = DIST_DIR / f"{APP_NAME}.app"
        loose_dir = DIST_DIR / APP_NAME
        if app_path.exists():
            zip_base = DIST_DIR / APP_NAME
            zip_path = zip_base.with_suffix(".zip")
            if zip_path.exists():
                zip_path.unlink()
            shutil.make_archive(str(zip_base), "zip", root_dir=DIST_DIR, base_dir=app_path.name)
            if loose_dir.exists():
                shutil.rmtree(loose_dir)
            outputs.extend([app_path, zip_path])
    elif sys.platform.startswith("win"):
        folder = DIST_DIR / APP_NAME
        if folder.exists():
            zip_base = DIST_DIR / APP_NAME
            zip_path = zip_base.with_suffix(".zip")
            if zip_path.exists():
                zip_path.unlink()
            shutil.make_archive(str(zip_base), "zip", root_dir=DIST_DIR, base_dir=folder.name)
            outputs.extend([folder, zip_path])
    return outputs


def main() -> int:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    SPEC_DIR.mkdir(parents=True, exist_ok=True)

    make_base_icon()
    make_icns()
    PyInstaller.__main__.run(build_args())

    outputs = package_outputs()
    for item in outputs:
        print(f"[done] {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
