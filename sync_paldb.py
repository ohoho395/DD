from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import sys
import time
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen

def resolve_project_dir() -> Path:
    override = os.environ.get("PALWORLD_HELPER_PROJECT_DIR")
    if override:
        return Path(override).expanduser().resolve()
    return Path(__file__).resolve().parent


PROJECT_DIR = resolve_project_dir()
RAW_DIR = PROJECT_DIR / "raw"
DB_PATH = RAW_DIR / "palcalc-db.json"
SYNC_JSON_PATH = PROJECT_DIR / "paldb-sync.json"
SYNC_JS_PATH = PROJECT_DIR / "synced-data.js"
CACHE_DIR = PROJECT_DIR / "cache" / "paldb"
DETAIL_CACHE_DIR = CACHE_DIR / "details"
DETAIL_CN_CACHE_DIR = CACHE_DIR / "details_cn"
RANKING_CACHE_DIR = CACHE_DIR / "rankings"
MAP_CACHE_DIR = CACHE_DIR / "map"
GENERATED_DIR = PROJECT_DIR / "generated"
GENERATED_STAGING_DIR = PROJECT_DIR / ".generated-next"
BASE_URL = "https://paldb.cc"
BASE_EN_URL = f"{BASE_URL}/en/"
BASE_CN_URL = f"{BASE_URL}/cn/"
MAP_DISTRIBUTION_URL = f"{BASE_URL}/DataTable/UI/DT_PaldexDistributionData.json"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/136.0.0.0 Safari/537.36"
)

JOB_PAGES = {
    "Kindling": "Kindling",
    "Watering": "Watering",
    "Planting": "Planting",
    "GenerateElectricity": "Generating_Electricity",
    "Handiwork": "Handiwork",
    "Gathering": "Gathering",
    "Lumbering": "Lumbering",
    "Mining": "Mining",
    "MedicineProduction": "Medicine_Production",
    "Cooling": "Cooling",
    "Transporting": "Transporting",
    "Farming": "Farming",
}

JOB_TITLE_TO_KEY = {
    "Kindling": "Kindling",
    "Watering": "Watering",
    "Planting": "Planting",
    "Generating Electricity": "GenerateElectricity",
    "Generate Electricity": "GenerateElectricity",
    "Handiwork": "Handiwork",
    "Gathering": "Gathering",
    "Lumbering": "Lumbering",
    "Mining": "Mining",
    "Medicine Production": "MedicineProduction",
    "Cooling": "Cooling",
    "Transporting": "Transporting",
    "Farming": "Farming",
}

PAL_CARD_RE = re.compile(
    r'<div class="col" data-filters="(?P<filters>[^"]*)">'
    r'<div class="card h-100"[^>]*>.*?'
    r'<span class="text-white-50 small">(?P<display_no>#[^<]*)</span>\s*'
    r'<a class="itemname"[^>]*href="(?P<slug>[^"]+)">(?P<name>[^<]+)</a>'
    r'(?P<header>.*?)'
    r'<div class="my-1">(?P<work>.*?)</div>.*?'
    r'<input type="checkbox"[^>]*value="(?P<internal_name>[^"]+)"',
    re.S,
)
ELEMENT_TITLE_RE = re.compile(r'data-bs-title="([^"]+)"')
WORK_BUTTON_RE = re.compile(r'data-bs-title="([^"]+)".*?class="size24"/> ?(\d+)</button>', re.S)
TABLE_RE = re.compile(r'<table class="table DataTable">(?P<body>.*?)</table>', re.S)
TABLE_ROW_RE = re.compile(r'<tr><td>(?P<cell>.*?)<td>(?P<level>\d+)', re.S)
WORK_LINE_RE = re.compile(
    r'<div class="border-bottom d-flex justify-content-between py-1 px-3">\s*'
    r'<div><a href="[^"]+"><img[^>]+/> (?P<label>[^<]+)</a></div>\s*'
    r'<div><span[^>]*>Lv</span>(?P<level>\d+)</div>',
    re.S,
)
MAP_BUTTON_RE = re.compile(
    r'href="(?P<href>Map\?pal=[^"]+&t=(?P<kind>dayTimeLocations|nightTimeLocations))"[^>]*>'
    r'.*?<span[^>]*>(?P<label>Day|Night)</span> \((?P<count>\d+)\)</a>',
    re.S,
)
DROP_ROW_RE = re.compile(
    r'<tr><td>(?P<item>.*?)<td>(?P<probability>[^<]+)</tr?>?',
    re.S,
)
SPAWNER_ROW_RE = re.compile(
    r'<tr><td>.*?<td>(?P<level>Lv\.[^<]+)<td><a href="[^"]+">(?P<source>[^<]+)</a> (?P<chance>[^<]+)',
    re.S,
)
MAP_IMAGE_DIR_RE = re.compile(r"imageMapDir:\s*'([^']+)'")
MAP_CONFIG_RE = re.compile(r"var config = (\{.*?\});var", re.S)
DEFAULT_MAP_CONFIG = {
    "minMapTextureBlockSize": {"X": 8192, "Y": 8192},
    "landScapeRealPositionMin": {"X": -999940, "Y": -737262, "Z": 1},
    "landScapeRealPositionMax": {"X": 447900, "Y": 710578, "Z": 1},
}
DEFAULT_IMAGE_MAP_DIR = "image/map7/"


def log(message: str) -> None:
    print(message, flush=True)


def code_from_id(raw_id: dict[str, Any]) -> str:
    return f"{raw_id['PalDexNo']}{'B' if raw_id['IsVariant'] else ''}"


def display_no(raw_id: dict[str, Any]) -> str:
    return f"#{raw_id['PalDexNo']}{'B' if raw_id['IsVariant'] else ''}"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def strip_tags(fragment: str) -> str:
    without_tags = re.sub(r"<[^>]+>", " ", fragment)
    return " ".join(unescape(without_tags).replace("\xa0", " ").split())


def clean_name(value: str) -> str:
    return " ".join(unescape(value).replace("\xa0", " ").split())


def clean_location(value: str) -> str:
    cleaned = clean_name(value).replace("_", " ")
    return re.sub(r"\s+", " ", cleaned).strip()


def dedupe_strings(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def slug_to_cache_name(slug: str) -> str:
    return quote(slug, safe="_-") + ".html"


def fetch_url(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urlopen(request, timeout=30) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def fetch_bytes(url: str) -> bytes:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urlopen(request, timeout=30) as response:
        return response.read()


def load_or_fetch(
    *,
    url: str,
    cache_path: Path,
    reuse_cache: bool,
    sample_dir: Path | None,
    sample_name: str | None = None,
    allow_skip: bool = False,
) -> str | None:
    if sample_dir:
        if sample_name is None:
            sample_name = cache_path.name
        sample_path = sample_dir / sample_name
        if sample_path.exists():
            return read_text(sample_path)
        if allow_skip:
            return None
        raise FileNotFoundError(f"Sample file not found: {sample_path}")

    if reuse_cache and cache_path.exists():
        return read_text(cache_path)

    try:
        text = fetch_url(url)
    except (HTTPError, URLError) as exc:
        if cache_path.exists():
            log(f"[warn] {exc} -> use cache {cache_path.name}")
            return read_text(cache_path)
        if allow_skip:
            log(f"[warn] skip {url}: {exc}")
            return None
        raise

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(text, encoding="utf-8")
    return text


def load_base_pals() -> list[dict[str, str]]:
    db = json.loads(DB_PATH.read_text(encoding="utf-8"))
    pals: list[dict[str, str]] = []
    for raw_pal in sorted(
        db["Pals"],
        key=lambda item: (item["Id"]["PalDexNo"], 1 if item["Id"]["IsVariant"] else 0),
    ):
        pals.append(
            {
                "code": code_from_id(raw_pal["Id"]),
                "displayNo": display_no(raw_pal["Id"]),
                "nameEn": raw_pal["Name"],
                "internalName": raw_pal["InternalName"],
                "fallbackSlug": raw_pal["Name"].replace(" ", "_"),
            }
        )
    return pals


def parse_pals_index(html: str) -> dict[str, dict[str, Any]]:
    pals: dict[str, dict[str, Any]] = {}
    for match in PAL_CARD_RE.finditer(html):
        current_display_no = match.group("display_no").strip()
        if not current_display_no.startswith("#") or current_display_no == "#":
            continue

        header_html = match.group("header")
        work_html = match.group("work")
        elements = [
            title
            for title in ELEMENT_TITLE_RE.findall(header_html)
            if title not in JOB_TITLE_TO_KEY and title != "Nocturnal"
        ]
        work: dict[str, int] = {}
        for label, level_text in WORK_BUTTON_RE.findall(work_html):
            job_key = JOB_TITLE_TO_KEY.get(label)
            if not job_key:
                continue
            work[job_key] = int(level_text)

        pals[current_display_no] = {
            "displayNo": current_display_no,
            "slug": clean_name(match.group("slug")),
            "nameEn": clean_name(match.group("name")),
            "elements": elements,
            "work": work,
            "internalName": clean_name(match.group("internal_name")),
        }
    return pals


def parse_job_ranking(html: str) -> list[dict[str, Any]]:
    table_match = TABLE_RE.search(html)
    if not table_match:
        return []

    results = []
    for rank, match in enumerate(TABLE_ROW_RE.finditer(table_match.group("body")), start=1):
        cell = match.group("cell")
        slug_match = re.search(r'href="([^"]+)"', cell)
        if not slug_match:
            continue
        name_match = re.search(r'href="[^"]+">([^<]+)</a>', cell)
        results.append(
            {
                "rank": rank,
                "slug": clean_name(slug_match.group(1)),
                "nameEn": clean_name(name_match.group(1)) if name_match else strip_tags(cell),
                "level": int(match.group("level")),
                "nocturnal": 'data-bs-title="Nocturnal"' in cell,
            }
        )
    return results


def parse_partner_skill(html: str) -> dict[str, str] | None:
    match = re.search(
        r'<div style="border-left: solid white"><span class="ms-2">(?P<title>.*?)</span> Lv\.\d+</div>\s*'
        r'<div class="d-flex">\s*<div class="flex-shrink-0 ps-1">.*?</div>\s*'
        r'<div class="flex-grow-1 ms-2">\s*(?P<body>.*?)\s*</div>',
        html,
        re.S,
    )
    if not match:
        return None

    title = clean_name(match.group("title"))
    description = strip_tags(match.group("body"))
    if not title and not description:
        return None
    return {
        "title": title,
        "description": description,
    }


def parse_work_from_detail(html: str) -> dict[str, int]:
    work: dict[str, int] = {}
    for label, level_text in WORK_LINE_RE.findall(html):
        job_key = JOB_TITLE_TO_KEY.get(clean_name(label))
        if not job_key:
            continue
        work[job_key] = int(level_text)
    return work


def parse_habitat(html: str, slug: str) -> dict[str, Any]:
    habitat: dict[str, Any] = {
        "dayCount": None,
        "nightCount": None,
        "dayUrl": f"{BASE_EN_URL}Map?pal={quote(slug)}&t=dayTimeLocations",
        "nightUrl": f"{BASE_EN_URL}Map?pal={quote(slug)}&t=nightTimeLocations",
    }
    for match in MAP_BUTTON_RE.finditer(html):
        count = int(match.group("count"))
        href = urljoin(BASE_EN_URL, match.group("href"))
        if match.group("kind") == "dayTimeLocations":
            habitat["dayCount"] = count
            habitat["dayUrl"] = href
        else:
            habitat["nightCount"] = count
            habitat["nightUrl"] = href
    return habitat


def parse_drops(html: str) -> list[dict[str, str]]:
    section_match = re.search(
        r'<h5 class="card-title text-info" data-i18n="paldex_drop_item_title">Possible Drops</h5>(?P<section>.*?)</table>',
        html,
        re.S,
    )
    if not section_match:
        return []

    drops = []
    for row in DROP_ROW_RE.finditer(section_match.group("section")):
        item_html = row.group("item")
        name_match = re.search(r'href="[^"]+">([^<]+)</a>', item_html)
        quantity_match = re.search(r'<small class="itemQuantity">(.*?)</small>', item_html, re.S)
        drops.append(
            {
                "name": clean_name(name_match.group(1)) if name_match else strip_tags(item_html),
                "quantity": clean_name(quantity_match.group(1)) if quantity_match else "",
                "probability": clean_name(row.group("probability")),
            }
        )
    return drops


def parse_spawns(html: str) -> list[dict[str, str]]:
    section_match = re.search(
        r'<h5 class="card-title text-info">Spawner</h5>(?P<section>.*?)</table>',
        html,
        re.S,
    )
    if not section_match:
        return []

    spawns = []
    for row in SPAWNER_ROW_RE.finditer(section_match.group("section")):
        level_text = clean_name(row.group("level"))
        if level_text.startswith("Lv. "):
            level_text = level_text[4:]
        spawns.append(
            {
                "level": level_text,
                "source": clean_location(row.group("source")),
                "chance": clean_name(row.group("chance")),
            }
        )
    return spawns


def parse_detail_page(html: str, slug: str) -> dict[str, Any]:
    header_display_no_match = re.search(r'<span class="text-white-50"[^>]*>(#[^<]+)</span>', html)
    header_elements = re.findall(r'<span style="padding-left: 35px">([^<]+)</span>', html)
    return {
        "displayNo": clean_name(header_display_no_match.group(1)) if header_display_no_match else "",
        "elements": dedupe_strings([clean_name(element) for element in header_elements]),
        "partnerSkill": parse_partner_skill(html),
        "work": parse_work_from_detail(html),
        "habitat": parse_habitat(html, slug),
        "drops": parse_drops(html),
        "spawns": parse_spawns(html),
    }


def extract_map_image_dir(map_page_html: str | None) -> str:
    if not map_page_html:
        return DEFAULT_IMAGE_MAP_DIR
    match = MAP_IMAGE_DIR_RE.search(map_page_html)
    if not match:
        return DEFAULT_IMAGE_MAP_DIR
    return match.group(1)


def extract_map_config(map_data_js: str | None) -> dict[str, Any]:
    if not map_data_js:
        return DEFAULT_MAP_CONFIG
    match = MAP_CONFIG_RE.search(map_data_js)
    if not match:
        return DEFAULT_MAP_CONFIG
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return DEFAULT_MAP_CONFIG


def normalize_locations(raw_locations: list[dict[str, Any]] | None) -> list[dict[str, int]]:
    if not raw_locations:
        return []
    normalized = []
    seen = set()
    for row in raw_locations:
        if "X" not in row or "Y" not in row:
            continue
        current = {"X": int(row["X"]), "Y": int(row["Y"])}
        key = (current["X"], current["Y"])
        if key in seen:
            continue
        seen.add(key)
        normalized.append(current)
    return normalized


def build_local_map_payload(
    args: argparse.Namespace,
    base_pals: list[dict[str, str]],
    sync_payload: dict[str, Any],
) -> dict[str, Any]:
    log("[stage] 读取地图配置与点位分布")
    map_page_html = load_or_fetch(
        url=f"{BASE_EN_URL}Map?pal=Lamball&t=dayTimeLocations",
        cache_path=MAP_CACHE_DIR / "map-page.html",
        reuse_cache=args.reuse_cache,
        sample_dir=args.sample_dir,
        sample_name="map-anubis-day.html",
        allow_skip=True,
    )
    map_data_js = load_or_fetch(
        url=f"{BASE_URL}/js/map_data_en.js",
        cache_path=MAP_CACHE_DIR / "map_data_en.js",
        reuse_cache=args.reuse_cache,
        sample_dir=args.sample_dir,
        sample_name="paldb-map-data-en.js",
        allow_skip=True,
    )
    distribution_text = load_or_fetch(
        url=MAP_DISTRIBUTION_URL,
        cache_path=MAP_CACHE_DIR / "DT_PaldexDistributionData.json",
        reuse_cache=args.reuse_cache,
        sample_dir=args.sample_dir,
        sample_name="DT_PaldexDistributionData.json",
    )
    if not distribution_text:
        raise RuntimeError("Unable to load pal distribution data from paldb.cc")

    distribution = json.loads(distribution_text)
    rows = distribution[0]["Rows"]
    image_map_dir = extract_map_image_dir(map_page_html)
    map_config = extract_map_config(map_data_js)

    pals_payload: dict[str, Any] = {}
    for base_pal in base_pals:
        row = rows.get(base_pal["internalName"])
        if not row:
            row = rows.get(base_pal["fallbackSlug"].replace(" ", "_"))

        day_locations = normalize_locations((row or {}).get("dayTimeLocations", {}).get("locations"))
        night_locations = normalize_locations((row or {}).get("nightTimeLocations", {}).get("locations"))
        pals_payload[base_pal["code"]] = {
            "rowKey": base_pal["internalName"],
            "day": day_locations,
            "night": night_locations,
        }

        synced_pal = sync_payload["pals"].get(base_pal["code"])
        if synced_pal:
            synced_pal.setdefault("habitat", {})
            synced_pal["habitat"]["dayCount"] = len(day_locations)
            synced_pal["habitat"]["nightCount"] = len(night_locations)

    return {
        "meta": {
            "syncedAt": sync_payload["meta"]["syncedAt"],
            "imageMapDir": image_map_dir,
            "tileSize": 512,
        },
        "config": map_config,
        "pals": pals_payload,
    }


def copy_or_download_map_tiles(
    args: argparse.Namespace,
    image_map_dir: str,
    config: dict[str, Any],
    target_root: Path,
) -> dict[str, int]:
    log("[stage] 生成本地地图瓦片缓存")
    tile_size = 512
    max_native_zoom = int(math.log2(config["minMapTextureBlockSize"]["X"] // tile_size))
    target_dir = target_root / "map-tiles" / Path(image_map_dir.rstrip("/")).name
    target_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    skipped = 0

    for zoom in range(max_native_zoom + 1):
        limit = 2 ** zoom
        for x in range(limit):
            for y in range(limit):
                relative_name = f"z{zoom}x{x}y{y}.webp"
                target_path = target_dir / relative_name
                existing_path = GENERATED_DIR / "map-tiles" / Path(image_map_dir.rstrip("/")).name / relative_name

                if args.reuse_cache and existing_path.exists():
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(existing_path, target_path)
                    copied += 1
                    continue

                if args.sample_dir:
                    continue

                tile_url = f"https://cdn.paldb.cc/{image_map_dir}{relative_name}"
                try:
                    tile_bytes = fetch_bytes(tile_url)
                except HTTPError as exc:
                    if exc.code in (403, 404):
                        skipped += 1
                        continue
                    raise
                target_path.write_bytes(tile_bytes)
                copied += 1
                if args.delay:
                    time.sleep(min(args.delay, 0.05))

    return {
        "copied": copied,
        "skipped": skipped,
    }


def write_local_map_assets(map_payload: dict[str, Any], args: argparse.Namespace) -> dict[str, Any]:
    if GENERATED_STAGING_DIR.exists():
        shutil.rmtree(GENERATED_STAGING_DIR)
    GENERATED_STAGING_DIR.mkdir(parents=True, exist_ok=True)

    tile_summary = copy_or_download_map_tiles(
        args,
        map_payload["meta"]["imageMapDir"],
        map_payload["config"],
        GENERATED_STAGING_DIR,
    )

    map_js_path = GENERATED_STAGING_DIR / "pal-map-data.js"
    map_js_path.write_text(
        "window.PALWORLD_LOCAL_MAPS = "
        + json.dumps(map_payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    if GENERATED_DIR.exists():
        shutil.rmtree(GENERATED_DIR)
    GENERATED_STAGING_DIR.rename(GENERATED_DIR)

    return {
        "tileCount": tile_summary["copied"],
        "missingTileCount": tile_summary["skipped"],
        "mapDir": map_payload["meta"]["imageMapDir"],
    }


def build_sync_payload(args: argparse.Namespace) -> dict[str, Any]:
    base_pals = load_base_pals()

    log("[stage] 读取帕鲁索引")
    pals_html = load_or_fetch(
        url=f"{BASE_EN_URL}Pals",
        cache_path=CACHE_DIR / "pals.html",
        reuse_cache=args.reuse_cache,
        sample_dir=args.sample_dir,
        sample_name="pals.html",
    )
    if not pals_html:
        raise RuntimeError("Unable to load pal index from paldb.cc")

    index_entries = parse_pals_index(pals_html)

    matched_pals: list[dict[str, str]] = []
    unmatched_display_numbers: list[str] = []
    slug_to_code: dict[str, str] = {}

    for base_pal in base_pals:
        current_display_no = base_pal["displayNo"]
        current_entry = index_entries.get(current_display_no)
        current_slug = current_entry["slug"] if current_entry else base_pal["fallbackSlug"]
        if current_entry:
            matched_pals.append(
                {
                    "code": base_pal["code"],
                    "displayNo": current_display_no,
                    "slug": current_slug,
                    "nameEn": base_pal["nameEn"],
                }
            )
        else:
            unmatched_display_numbers.append(current_display_no)
            matched_pals.append(
                {
                    "code": base_pal["code"],
                    "displayNo": current_display_no,
                    "slug": current_slug,
                    "nameEn": base_pal["nameEn"],
                }
            )
        slug_to_code[current_slug] = base_pal["code"]

    if args.limit is not None:
        matched_pals = matched_pals[: args.limit]

    job_rankings: dict[str, list[dict[str, Any]]] = {}
    ranking_failures: list[str] = []
    log("[stage] 读取岗位榜单")
    for job_key, page_slug in JOB_PAGES.items():
        log(f"[rank] {job_key}")
        try:
            ranking_html = load_or_fetch(
                url=f"{BASE_EN_URL}{page_slug}",
                cache_path=RANKING_CACHE_DIR / f"{page_slug}.html",
                reuse_cache=args.reuse_cache,
                sample_dir=args.sample_dir,
                sample_name=f"{page_slug.lower()}.html",
                allow_skip=bool(args.sample_dir),
            )
        except Exception as exc:
            ranking_failures.append(f"{job_key}: {exc}")
            continue
        if not ranking_html:
            continue

        current_rows = []
        for entry in parse_job_ranking(ranking_html):
            code = slug_to_code.get(entry["slug"])
            if not code:
                continue
            current_rows.append(
                {
                    "code": code,
                    "slug": entry["slug"],
                    "level": entry["level"],
                    "rank": entry["rank"],
                    "nocturnal": entry["nocturnal"],
                }
            )

        if current_rows:
            job_rankings[job_key] = current_rows
        else:
            ranking_failures.append(job_key)

        if not args.sample_dir and args.delay:
            time.sleep(args.delay)

    pals_payload: dict[str, Any] = {}
    detail_failures: list[str] = []
    log("[stage] 读取帕鲁详情")
    for index, pal in enumerate(matched_pals, start=1):
        slug = pal["slug"]
        log(f"[sync] {index}/{len(matched_pals)} {pal['displayNo']} {slug}")
        try:
            detail_html = load_or_fetch(
                url=f"{BASE_CN_URL}{quote(slug)}",
                cache_path=DETAIL_CN_CACHE_DIR / slug_to_cache_name(slug),
                reuse_cache=args.reuse_cache,
                sample_dir=args.sample_dir,
                sample_name=f"{slug.lower()}.html",
                allow_skip=bool(args.sample_dir),
            )
        except Exception as exc:
            detail_failures.append(f"{pal['displayNo']} {slug}: {exc}")
            continue
        if not detail_html:
            continue

        try:
            detail = parse_detail_page(detail_html, slug)
        except Exception as exc:  # pragma: no cover - defensive for brittle upstream HTML
            detail_failures.append(f"{pal['displayNo']} {slug}: {exc}")
            continue

        index_entry = index_entries.get(pal["displayNo"], {})
        pals_payload[pal["code"]] = {
            "slug": slug,
            "palPageUrl": f"{BASE_CN_URL}{quote(slug)}",
            "elements": detail["elements"] or index_entry.get("elements", []),
            "partnerSkill": detail["partnerSkill"],
            "work": detail["work"] or index_entry.get("work", {}),
            "habitat": detail["habitat"],
            "drops": detail["drops"],
            "spawns": detail["spawns"],
        }

        if not args.sample_dir and args.delay:
            time.sleep(args.delay)

    return {
        "meta": {
            "source": "paldb.cc",
            "sourceUrl": f"{BASE_EN_URL}Pals",
            "syncedAt": datetime.now(timezone.utc).isoformat(),
            "mode": "sample" if args.sample_dir else "network",
            "matchedPalCount": len(pals_payload),
            "basePalCount": len(base_pals),
            "unmatchedDisplayNumbers": unmatched_display_numbers,
            "rankingFailures": ranking_failures,
            "detailFailures": detail_failures,
        },
        "jobRankings": job_rankings,
        "pals": pals_payload,
    }, base_pals


def write_outputs(payload: dict[str, Any]) -> None:
    SYNC_JSON_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    SYNC_JS_PATH.write_text(
        "window.PALWORLD_SYNC_DATA = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync Palworld helper data from paldb.cc")
    parser.add_argument(
        "--sample-dir",
        type=Path,
        help="Use local HTML samples instead of network requests.",
    )
    parser.add_argument(
        "--reuse-cache",
        action="store_true",
        help="Reuse cached HTML when available.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Only sync the first N pals for testing.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.12,
        help="Delay between live requests in seconds.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    try:
        log("[stage] 开始同步 paldb.cc")
        payload, base_pals = build_sync_payload(args)
        map_payload = build_local_map_payload(args, base_pals, payload)
        map_summary = write_local_map_assets(map_payload, args)
    except Exception as exc:
        print(f"[error] {exc}", file=sys.stderr, flush=True)
        return 1

    log("[stage] 写入本地缓存")
    write_outputs(payload)
    log(f"[done] wrote {GENERATED_DIR / 'pal-map-data.js'}")
    log(f"[done] map tiles refreshed: {map_summary['tileCount']}")
    if map_summary["missingTileCount"]:
        log(f"[warn] map tiles not published upstream and skipped: {map_summary['missingTileCount']}")
    log(f"[done] wrote {SYNC_JSON_PATH}")
    log(f"[done] wrote {SYNC_JS_PATH}")
    log(f"[done] synced pals: {payload['meta']['matchedPalCount']}")
    if payload["meta"]["unmatchedDisplayNumbers"]:
        log(f"[warn] unmatched display numbers: {len(payload['meta']['unmatchedDisplayNumbers'])}")
    if payload["meta"]["rankingFailures"]:
        log(f"[warn] ranking failures: {', '.join(payload['meta']['rankingFailures'])}")
    if payload["meta"]["detailFailures"]:
        log(f"[warn] detail failures: {len(payload['meta']['detailFailures'])}")
    log("[done] 同步流程完成")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
