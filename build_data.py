from __future__ import annotations

import json
import os
import re
import shutil
import time
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen


PROJECT_DIR = Path(__file__).resolve().parent
RAW_DIR = PROJECT_DIR / "raw"
DB_PATH = RAW_DIR / "palcalc-db.json"
BREEDING_PATH = RAW_DIR / "breeding.json"
OUTPUT_PATH = PROJECT_DIR / "data.js"
ASSETS_PALS_DIR = PROJECT_DIR / "assets" / "pals"
ICON_SOURCE_DIR = Path(
    os.environ.get("PALWORLD_HELPER_ICON_SOURCE_DIR", "/tmp/palcalc-source/PalCalc.UI/Resources/Pals")
)
PALCALC_DB_URLS = [
    "https://raw.githubusercontent.com/tylercamp/palcalc/main/PalCalc.Model/db.json",
    "https://cdn.jsdelivr.net/gh/tylercamp/palcalc@main/PalCalc.Model/db.json",
]
PALCALC_BREEDING_URLS = [
    "https://raw.githubusercontent.com/tylercamp/palcalc/main/PalCalc.Model/breeding.json",
    "https://cdn.jsdelivr.net/gh/tylercamp/palcalc@main/PalCalc.Model/breeding.json",
]
PALDB_PALS_URL = "https://paldb.cc/en/Pals"
HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
}
PAL_CARD_PATTERN = re.compile(
    r'href="(?P<href>[^"]+)"><img[^>]+src="(?P<src>https://cdn\.paldb\.cc/image/Pal/Texture/PalIcon/Normal/[^"]+)"',
    re.IGNORECASE,
)

JOBS = [
    ("Kindling", "生火"),
    ("Watering", "浇水"),
    ("Planting", "播种"),
    ("GenerateElectricity", "发电"),
    ("Handiwork", "手工"),
    ("Gathering", "采集"),
    ("Lumbering", "伐木"),
    ("Mining", "采矿"),
    ("MedicineProduction", "制药"),
    ("Cooling", "制冷"),
    ("Transporting", "搬运"),
    ("Farming", "牧场"),
]

STAGE_OPTIONS = [
    {"key": "all", "label": "全部阶段"},
    {"key": "early", "label": "前期好抓"},
    {"key": "mid", "label": "中期成型"},
    {"key": "late", "label": "后期毕业"},
    {"key": "special", "label": "特殊 / 不常驻"},
]

FARM_GUIDE = [
    ("ChickenPal", "产蛋", "前期最稳的蛋来源，厨房和烘焙需求高时很常用。"),
    ("CowPal", "产奶", "做蛋糕、料理都会用到，长期价值很高。"),
    ("SoldierBee", "产蜂蜜", "做蛋糕的核心材料之一，建议早点留一只。"),
    ("CuteFox", "出球和金币", "开荒很舒服，适合早期补帕鲁球和基础资源。"),
    ("WoolFox", "产羊毛", "前中期布料来源很稳，需求量也不低。"),
    ("WhiteMoth", "产优质布料", "中后期更省加工步骤，适合稳定成衣线。"),
    ("Bastet", "产金币", "挂机补点金币还不错，适合作为顺手副产。"),
    ("Bastet_Ice", "产金币", "和喵丝特类似，更偏收藏或补位。"),
    ("SweetsSheep", "产棉花糖", "偏休闲和料理向，可当特色副产线。"),
    ("Kelpie", "产帕鲁体液", "做材料时很好用，省得反复外出刷怪。"),
    ("Kelpie_Fire", "产喷火器官", "火属性材料线很省心，适合中后期。"),
    ("PlantSlime_Flower", "产美丽花朵", "配方和卖钱都方便，属于偏功能向牧场位。"),
    ("BerryGoat", "产红莓", "开荒补食物最稳定，适合作为最早期农牧位。"),
    ("LazyCatfish", "产优质帕鲁油", "中后期很实用，减少你刷材料的时间。"),
]

WORK_TIPS = [
    {
        "title": "主工词条思路",
        "body": "工作速度优先，其次看是否能夜班。做据点主力时，先让主工作等级高，再考虑副职是否顺手。"
    },
    {
        "title": "夜班位怎么选",
        "body": "夜行能明显减少断档，适合采矿、搬运、制冷这类长时间持续工作的岗位。"
    },
    {
        "title": "搬运别只看等级",
        "body": "搬运除了适应性等级，也要看移动速度和食量。速度快、吃得少，长期效率会更高。"
    },
    {
        "title": "毕业位与过渡位",
        "body": "前期先看好抓和好配；后期再追求 4 级工位和更优的多面副职，不必一开始就硬追毕业帕鲁。"
    },
]

SPECIAL_NOTES = {
    "Anubis": "据点最常见的毕业手工位之一，兼顾采矿和搬运。",
    "Umihebi": "顶级浇水位之一，后期种植和工厂线非常舒服。",
    "LilyQueen": "播种和制药都强，属于标准的后期农业核心。",
    "ThunderDragonMan": "高发电位，后期电力设施成型后价值很高。",
    "IceHorse": "标准毕业制冷位，适合冰箱和食材线长期驻场。",
    "Horus": "生火效率高，移动也快，做熔炉线和烹饪线都很顺手。",
    "VolcanicMonster": "顶级采矿位之一，矿场和煤矿线很省心。",
    "WhiteMoth": "牧场产优质布料，属于非常省加工步骤的功能位。",
    "CuteFox": "开荒很好用，兼顾牧场与低门槛实用性。",
}

FEATURED_INTERNAL_NAMES = [
    "Anubis",
    "Umihebi",
    "LilyQueen",
    "ThunderDragonMan",
    "IceHorse",
    "Horus",
    "VolcanicMonster",
    "WhiteMoth",
    "CuteFox",
]


def fetch_text(url: str, *, retries: int = 3) -> str:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            request = Request(url, headers=HTTP_HEADERS)
            with urlopen(request, timeout=45) as response:
                return response.read().decode("utf-8")
        except Exception as error:  # pragma: no cover - network jitter handling
            last_error = error
            if attempt == retries:
                break
            time.sleep(min(6, attempt * 2))
    assert last_error is not None
    raise last_error


def ensure_json(path: Path, urls: list[str]) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    last_error: Exception | None = None
    for url in urls:
        try:
            text = fetch_text(url)
            path.write_text(text, encoding="utf-8")
            return json.loads(text)
        except Exception as error:  # pragma: no cover - network jitter handling
            last_error = error
    assert last_error is not None
    raise last_error


def pal_slug(name: str) -> str:
    return quote(name.replace(" ", "_"))


def load_paldb_icon_map() -> dict[str, str]:
    html = fetch_text(PALDB_PALS_URL)
    icon_map: dict[str, str] = {}
    for match in PAL_CARD_PATTERN.finditer(html):
        href = match.group("href").strip().lstrip("./")
        if not href or href.startswith("http"):
            continue
        icon_map[href] = match.group("src")
    return icon_map


def code_from_id(raw_id: dict) -> str:
    return f"{raw_id['PalDexNo']}{'B' if raw_id['IsVariant'] else ''}"


def stage_from_levels(min_level: int | None, max_level: int | None) -> tuple[str, str]:
    if min_level is None or max_level is None:
        return ("special", "通常不在普通野外常驻，更适合从外部地图页确认刷新方式。")
    if max_level <= 20:
        return ("early", f"偏前期可入手，常见野外等级约 {min_level}-{max_level}。")
    if max_level <= 35:
        return ("mid", f"偏中期区域，常见野外等级约 {min_level}-{max_level}。")
    return ("late", f"偏中后期或高危区域，常见野外等级约 {min_level}-{max_level}。")


def job_summary(work: dict[str, int]) -> list[str]:
    ranked = sorted(
        [(key, value) for key, value in work.items() if value > 0],
        key=lambda item: (-item[1], item[0]),
    )
    return [f"{job_label(key)} {value}" for key, value in ranked[:3]]


def job_label(key: str) -> str:
    for internal, label in JOBS:
        if internal == key:
            return label
    return key


def tier_text(pal: dict) -> str:
    if pal["stageKey"] == "special":
        return "特殊 / 不常驻"
    if pal["stageKey"] == "early":
        return "前期好抓"
    if pal["stageKey"] == "mid":
        return "中期成型"
    return "后期毕业"


def worker_reason(pal: dict, focus_job: str | None = None) -> str:
    non_zero = sorted(
        [(job_label(key), value) for key, value in pal["work"].items() if value > 0],
        key=lambda item: (-item[1], item[0]),
    )
    if not non_zero:
        return "这只帕鲁不以据点打工见长，更适合作为战斗、坐骑或功能位。"
    parts = [f"主打 {non_zero[0][0]} {non_zero[0][1]}"]
    if len(non_zero) > 1:
        parts.append("副职 " + " / ".join(f"{name} {value}" for name, value in non_zero[1:3]))
    if pal["nocturnal"]:
        parts.append("可夜班")
    if focus_job == "Transporting":
        parts.append(f"搬运速度 {pal['transportSpeed']}")
    parts.append(f"食量 {pal['foodAmount']}")
    return "，".join(parts) + "。"


def build() -> None:
    db = ensure_json(DB_PATH, PALCALC_DB_URLS)
    breeding = ensure_json(BREEDING_PATH, PALCALC_BREEDING_URLS)
    icon_map = load_paldb_icon_map()

    ASSETS_PALS_DIR.mkdir(parents=True, exist_ok=True)
    pals = []
    pals_by_code = {}
    copied_icons = 0
    missing_icons = []
    remote_icons = 0

    for raw_pal in sorted(
        db["Pals"],
        key=lambda item: (item["Id"]["PalDexNo"], 1 if item["Id"]["IsVariant"] else 0),
    ):
        code = code_from_id(raw_pal["Id"])
        slug = pal_slug(raw_pal["Name"])
        work = {job_key: raw_pal["WorkSuitability"].get(job_key, 0) for job_key, _ in JOBS}
        stage_key, spawn_hint = stage_from_levels(raw_pal["MinWildLevel"], raw_pal["MaxWildLevel"])
        name_zh = raw_pal["LocalizedNames"].get("zh-Hans") or raw_pal["Name"]
        display_no = f"#{raw_pal['Id']['PalDexNo']}{'B' if raw_pal['Id']['IsVariant'] else ''}"
        icon_target = ASSETS_PALS_DIR / f"{code}.png"
        icon_source = ICON_SOURCE_DIR / f"{raw_pal['Name']}.png"
        icon_url = f"./assets/pals/{code}.png"
        if icon_source.exists():
            shutil.copy2(icon_source, icon_target)
            copied_icons += 1
        elif icon_target.exists():
            pass
        else:
            icon_url = (
                icon_map.get(slug)
                or icon_map.get(raw_pal["Name"])
                or icon_map.get(raw_pal["Name"].replace(" ", "_"))
                or icon_map.get(raw_pal["Name"].replace(" ", "%20"))
                or ""
            )
            if icon_url:
                remote_icons += 1
            else:
                missing_icons.append(raw_pal["Name"])

        pal = {
            "code": code,
            "dexNo": raw_pal["Id"]["PalDexNo"],
            "isVariant": raw_pal["Id"]["IsVariant"],
            "displayNo": display_no,
            "nameZh": name_zh,
            "nameEn": raw_pal["Name"],
            "internalName": raw_pal["InternalName"],
            "breedingPower": raw_pal["BreedingPower"],
            "rarity": raw_pal["Rarity"],
            "size": raw_pal["Size"],
            "nocturnal": raw_pal["Nocturnal"],
            "minWildLevel": raw_pal["MinWildLevel"],
            "maxWildLevel": raw_pal["MaxWildLevel"],
            "foodAmount": raw_pal["FoodAmount"],
            "transportSpeed": raw_pal["TransportSpeed"],
            "runSpeed": raw_pal["RunSpeed"],
            "rideSprintSpeed": raw_pal["RideSprintSpeed"],
            "craftSpeed": raw_pal["CraftSpeed"],
            "stats": {
                "hp": raw_pal["Hp"],
                "attack": raw_pal["Attack"],
                "defense": raw_pal["Defense"],
            },
            "work": work,
            "workSummary": job_summary(work),
            "stageKey": stage_key,
            "stageLabel": tier_text({"stageKey": stage_key}),
            "spawnHint": spawn_hint,
            "mapUrl": f"https://paldb.cc/en/Map?pal={raw_pal['InternalName']}&t=dayTimeLocations",
            "palPageUrl": f"https://paldb.cc/en/{slug}",
            "iconUrl": icon_url,
            "note": SPECIAL_NOTES.get(raw_pal["InternalName"], ""),
        }
        pals.append(pal)
        pals_by_code[code] = pal

    breeding_by_child: dict[str, list[list[str]]] = defaultdict(list)
    breeding_by_pair: dict[str, list[list[str]]] = defaultdict(list)

    seen_child = defaultdict(set)
    seen_pair = defaultdict(set)

    for entry in breeding["Breeding"]:
        parent1_code = code_from_id(entry["Parent1ID"])
        parent2_code = code_from_id(entry["Parent2ID"])
        child_code = code_from_id(entry["ChildID"])
        payload = [
            parent1_code,
            parent2_code,
            child_code,
            entry["Parent1Gender"],
            entry["Parent2Gender"],
        ]

        child_key = child_code
        pair_key = f"{parent1_code}|{parent2_code}"
        child_hash = tuple(payload)
        pair_hash = tuple(payload[2:])

        if child_hash not in seen_child[child_key]:
            breeding_by_child[child_key].append(payload)
            seen_child[child_key].add(child_hash)

        if pair_hash not in seen_pair[pair_key]:
            breeding_by_pair[pair_key].append(payload[2:])
            seen_pair[pair_key].add(pair_hash)

    featured = []
    for internal_name in FEATURED_INTERNAL_NAMES:
        pal = next((item for item in pals if item["internalName"] == internal_name), None)
        if not pal:
            continue
        featured.append(
            {
                "code": pal["code"],
                "nameZh": pal["nameZh"],
                "label": f"{pal['displayNo']} {pal['nameZh']}",
                "reason": worker_reason(pal),
            }
        )

    farm_specialists = []
    for internal_name, drop_label, note in FARM_GUIDE:
        pal = next((item for item in pals if item["internalName"] == internal_name), None)
        if not pal:
            continue
        farm_specialists.append(
            {
                "code": pal["code"],
                "nameZh": pal["nameZh"],
                "displayNo": pal["displayNo"],
                "dropLabel": drop_label,
                "note": note,
                "mapUrl": pal["mapUrl"],
            }
        )

    payload = {
        "meta": {
            "name": "Palworld Dex Helper",
            "gameDataVersion": db.get("Version", "unknown"),
            "palCount": len(pals),
            "breedingComboCount": len(breeding["Breeding"]),
        },
        "jobs": [{"key": key, "label": label} for key, label in JOBS],
        "stageOptions": STAGE_OPTIONS,
        "workTips": WORK_TIPS,
        "featuredTargets": featured,
        "farmSpecialists": farm_specialists,
        "sources": [
            {
                "label": "tylercamp/palcalc db.json",
                "url": "https://github.com/tylercamp/palcalc/blob/main/PalCalc.Model/db.json",
            },
            {
                "label": "tylercamp/palcalc breeding.json",
                "url": "https://github.com/tylercamp/palcalc/blob/main/PalCalc.Model/breeding.json",
            },
            {
                "label": "Paldb pals pages",
                "url": "https://paldb.cc/en/Pals",
            },
        ],
        "pals": pals,
        "breedingByChild": dict(breeding_by_child),
        "breedingByPair": dict(breeding_by_pair),
    }

    OUTPUT_PATH.write_text(
        "window.PALWORLD_DATA = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    print(f"Wrote {OUTPUT_PATH}")
    print(f"Pals: {len(pals)}")
    print(f"Breeding combos: {len(breeding['Breeding'])}")
    print(f"Icons copied: {copied_icons}")
    print(f"Icons from paldb CDN: {remote_icons}")
    if missing_icons:
        print(f"Missing icons: {len(missing_icons)}")


if __name__ == "__main__":
    build()
