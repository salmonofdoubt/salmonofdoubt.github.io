#!/usr/bin/env python3
from __future__ import annotations

import csv
import io
import json
import re
from pathlib import Path
from typing import Iterable

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": "Dublin-Representative-Finder-Updater/1.0 (+GitHub Actions)",
    "Accept": "text/html,application/json,text/csv,*/*",
}

URLS = {
    "tds_csv": "https://data.oireachtas.ie/ie/oireachtas/communications/other/2024/2024-12-13_contact-details-tds_en.csv",
    "dcc_csv": "https://data.smartdublin.ie/dataset/3b96f6f0-3873-4ea9-94a2-646bbd3db113/resource/95e8a95c-4d48-4164-9fb1-e02fc8026893/download/councillor_details_dcc.csv",
    "dlr_csv": "https://data.smartdublin.ie/dataset/ddda5519-652c-4cb8-9dd0-66068e727d8d/resource/a03cc5eb-0893-4e0d-bf3c-55fc203a7082/download/councillors_dlr.csv",
    "fingal_page": "https://www.fingal.ie/council/councillors",
    "sdcc_list": "https://www.sdcc.ie/en/services/our-council/councillors/",
}

LOCAL_AUTHORITY_FALLBACKS = {
    "South Dublin County Council": {
        "message": "South Dublin County Council matched. This GitHub Pages build shows the official council contact and councillors directory while detailed LEA-to-councillor data is refreshed separately.",
        "contacts": [
            {
                "name": "South Dublin County Council",
                "party": "Council contact",
                "email": "info@sdublincoco.ie",
                "phone": "+353 1 414 9000",
                "address": "County Hall, Tallaght, Dublin 24, D24 A3XC",
                "website": "https://www.sdcc.ie/en/services/our-council/councillors/",
            }
        ],
    }
}


def get(url: str) -> requests.Response:
    response = requests.get(url, headers=HEADERS, timeout=40)
    response.raise_for_status()
    return response


def decode_bytes(raw: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def normalize_text(value: str) -> str:
    value = (value or "").strip().upper()
    value = re.sub(r"\s+", " ", value)
    return value


def write_json(name: str, payload) -> None:
    (DATA_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def update_tds() -> list[dict]:
    text = decode_bytes(get(URLS["tds_csv"]).content)
    rows = list(csv.reader(io.StringIO(text)))
    header = rows[1]
    out = []
    for row in rows[2:]:
        if len(row) < 5:
            continue
        rec = dict(zip(header, row))
        if not rec["Constituency"].startswith("Dublin"):
            continue
        out.append(
            {
                "name": rec["Name"].strip(),
                "party": rec["PartyElected"].strip(),
                "email": rec["Oireachtas Email"].strip(),
                "phone": "",
                "address": rec["Dáil Address"].strip(),
                "constituency": rec["Constituency"].strip(),
                "website": "https://www.oireachtas.ie/en/members/",
            }
        )
    return out


def update_dcc() -> list[dict]:
    text = decode_bytes(get(URLS["dcc_csv"]).content)
    rows = list(csv.reader(io.StringIO(text)))
    header = rows[0]
    out = []
    for row in rows[1:]:
        if not any(row):
            continue
        row = [c.strip() for c in row]
        if len(row) < 6:
            row += [""] * (6 - len(row))
        if len(row) > 6:
            row = row[:5] + [", ".join(row[5:])]
        rec = dict(zip(header, row))
        ward = rec["Ward"].strip()
        lea = rec["LEA"].strip()
        if ":" not in ward and ":" in lea:
            ward, lea = lea, ward
        lea = lea.split(":")[0].strip().upper()
        if lea == "CLONTAF":
            lea = "CLONTARF"
        out.append(
            {
                "name": rec["Name"].strip(),
                "party": rec["Party"].strip(),
                "email": rec["email"].strip(),
                "phone": "",
                "address": "",
                "lea": lea.title(),
                "council": "Dublin City Council",
                "website": "https://www.dublincity.ie/residential/your-council/lord-mayor-and-councillors",
            }
        )
    return out


def update_dlr() -> list[dict]:
    text = decode_bytes(get(URLS["dlr_csv"]).content)
    rows = list(csv.DictReader(io.StringIO(text)))
    out = []
    for rec in rows:
        out.append(
            {
                "name": rec["Name"].replace("Cllr ", "").replace("Cllr. ", "").strip(),
                "party": rec["Party"].strip(),
                "email": rec["Email "].strip(),
                "phone": "",
                "address": "",
                "lea": rec["Local electoral area"].strip(),
                "council": "Dún Laoghaire-Rathdown County Council",
                "website": "https://www.dlrcoco.ie/council-and-democracy/councillors-and-meetings/councillors",
            }
        )
    return out


def compact_lines(soup: BeautifulSoup) -> list[str]:
    text = soup.get_text("\n")
    return [line.strip() for line in text.splitlines() if line.strip()]


def update_fingal() -> list[dict]:
    soup = BeautifulSoup(get(URLS["fingal_page"]).text, "html.parser")
    lines = compact_lines(soup)
    areas = {"Balbriggan", "Castleknock", "Howth-Malahide", "Howth–Malahide", "Blanchardstown-Mulhuddart", "Swords", "Ongar", "Rush-Lusk"}
    out = []
    current_lea = None
    i = 0
    while i < len(lines):
        line = lines[i]
        if line in areas:
            current_lea = line.replace("–", "-")
            i += 1
            continue
        if line.startswith("Cllr") and current_lea:
            name = re.sub(r"^Cllr\.?\s*", "", line).strip()
            party = lines[i + 1] if i + 1 < len(lines) else ""
            phone = lines[i + 2] if i + 2 < len(lines) else ""
            email = lines[i + 3] if i + 3 < len(lines) else ""
            address = lines[i + 4] if i + 4 < len(lines) else ""
            if "@" in email:
                out.append(
                    {
                        "name": name,
                        "party": party,
                        "email": email,
                        "phone": phone,
                        "address": address,
                        "lea": current_lea,
                        "council": "Fingal County Council",
                        "website": "https://www.fingal.ie/council/councillors",
                    }
                )
                i += 5
                continue
        i += 1
    return out


def update_sdcc() -> list[dict]:
    soup = BeautifulSoup(get(URLS["sdcc_list"]).text, "html.parser")
    profile_links = []
    for a in soup.select('a[href*="/services/our-council/councillors/"]'):
        href = a.get("href", "")
        if href.endswith(".html"):
            if href.startswith("/"):
                href = f"https://www.sdcc.ie{href}"
            profile_links.append(href)
    profile_links = list(dict.fromkeys(profile_links))

    out = []
    for url in profile_links:
        page = BeautifulSoup(get(url).text, "html.parser")
        lines = compact_lines(page)
        title = next((line for line in lines if line.startswith("Cllr") or line.startswith("Mayor ")), "")
        name = re.sub(r"^Mayor\s+", "", title)
        name = re.sub(r"^Cllr\.?\s*", "", name).strip()
        def after(label: str) -> str:
            try:
                idx = lines.index(label)
                return lines[idx + 1]
            except Exception:
                return ""
        lea = after("Electoral Area:")
        party = after("Party:")
        email = after("Email:")
        if name and lea and email:
            out.append(
                {
                    "name": name,
                    "party": party,
                    "email": email,
                    "phone": "",
                    "address": "County Hall, Tallaght, Dublin 24, D24 A3XC",
                    "lea": lea,
                    "council": "South Dublin County Council",
                    "website": url,
                }
            )
    return out


def main() -> None:
    tds = update_tds()
    dcc = update_dcc()
    dlr = update_dlr()

    try:
        fingal = update_fingal()
    except Exception:
        fingal = []

    try:
        sdcc = update_sdcc()
    except Exception:
        sdcc = []

    councillors = dcc + dlr + fingal + sdcc
    write_json("tds.json", tds)
    write_json("councillors.json", councillors)
    write_json("fallbacks.json", LOCAL_AUTHORITY_FALLBACKS)
    write_json(
        "meta.json",
        {
            "generated_by": "scripts/update_data.py",
            "td_count": len(tds),
            "councillor_count": len(councillors),
            "notes": [
                "TDs sourced from the official Oireachtas contact CSV.",
                "DCC and DLR sourced from official open-data CSV resources.",
                "Fingal sourced from the official councillors page.",
                "SDCC sourced from the official councillors directory where profile pages could be parsed.",
            ],
        },
    )
    print(f"Updated {len(tds)} TDs and {len(councillors)} councillor rows.")


if __name__ == "__main__":
    main()
