from __future__ import annotations

import base64
import json
import re
import shutil
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art"
ARTWORKS_PATH = ART / "data" / "artworks.json"

PRIVATE_ROOT = ROOT / ".art-private" / "related"
MASTER_PATH = PRIVATE_ROOT / "related-master.json"
PRIVATE_REFERENCES = PRIVATE_ROOT / "references"

PUBLIC_PATH = ART / "data" / "related-public.json"
PUBLIC_REFERENCES = ART / "assets" / "related"

VISIBILITIES = {"public", "private", "metadata"}
KINDS = {"artwork", "reference"}


def read_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def default_master() -> dict:
    return {"version": 1, "sets": [], "references": []}


def normalize_master(payload: dict | None) -> dict:
    payload = payload if isinstance(payload, dict) else {}
    normalized = {"version": 1, "sets": [], "references": []}

    seen_sets = set()
    for raw_set in payload.get("sets", []):
        if not isinstance(raw_set, dict):
            continue
        set_id = str(raw_set.get("id") or "").strip()
        if not set_id or set_id in seen_sets:
            continue
        seen_sets.add(set_id)

        members = []
        seen_members = set()
        for raw_member in raw_set.get("members", []):
            if not isinstance(raw_member, dict):
                continue
            kind = str(raw_member.get("kind") or "").strip()
            member_id = str(raw_member.get("id") or "").strip()
            if kind not in KINDS or not member_id:
                continue
            key = (kind, member_id)
            if key in seen_members:
                continue
            seen_members.add(key)
            members.append({
                "kind": kind,
                "id": member_id,
                "role": str(raw_member.get("role") or "related").strip(),
                "note": str(raw_member.get("note") or "").strip(),
            })

        normalized["sets"].append({
            "id": set_id,
            "title": str(raw_set.get("title") or "Untitled related set").strip(),
            "description": str(raw_set.get("description") or "").strip(),
            "members": members,
        })

    seen_refs = set()
    for raw_ref in payload.get("references", []):
        if not isinstance(raw_ref, dict):
            continue
        ref_id = str(raw_ref.get("id") or "").strip()
        if not ref_id or ref_id in seen_refs:
            continue
        seen_refs.add(ref_id)

        visibility = str(raw_ref.get("visibility") or "private").strip().lower()
        if visibility not in VISIBILITIES:
            visibility = "private"

        normalized["references"].append({
            "id": ref_id,
            "title": str(raw_ref.get("title") or "Reference").strip(),
            "creator": str(raw_ref.get("creator") or "").strip(),
            "rights": str(raw_ref.get("rights") or "").strip(),
            "sourceUrl": str(raw_ref.get("sourceUrl") or "").strip(),
            "notes": str(raw_ref.get("notes") or "").strip(),
            "visibility": visibility,
            "file": str(raw_ref.get("file") or "").strip(),
            "originalFilename": str(raw_ref.get("originalFilename") or "").strip(),
            "createdAt": str(raw_ref.get("createdAt") or "").strip(),
        })

    return normalized


def load_master() -> dict:
    if not MASTER_PATH.exists():
        return default_master()
    return normalize_master(read_json(MASTER_PATH, default_master()))


def save_master(payload: dict) -> dict:
    normalized = normalize_master(payload)
    write_json(MASTER_PATH, normalized)
    return normalized


def slugify(value: str) -> str:
    value = str(value or "").lower().strip()
    value = re.sub(r"[^\w\s-]", "", value)
    value = re.sub(r"[\s_-]+", "-", value)
    return value.strip("-") or "reference"


def decode_data_url(data_url: str) -> tuple[bytes, str]:
    if "," not in data_url:
        raise ValueError("Reference upload is not a valid data URL")

    header, encoded = data_url.split(",", 1)
    match = re.search(r"data:([^;]+);base64", header)
    mime = match.group(1).lower() if match else "image/jpeg"

    ext_by_mime = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/avif": ".avif",
    }
    return base64.b64decode(encoded), ext_by_mime.get(mime, ".jpg")


def add_reference_upload(payload: dict) -> tuple[dict, dict]:
    set_id = str(payload.get("setId") or "").strip()
    if not set_id:
        raise ValueError("Choose a related set first")

    data_url = str(payload.get("imageDataUrl") or "")
    if not data_url:
        raise ValueError("Choose a reference image first")

    master = load_master()
    related_set = next((item for item in master["sets"] if item.get("id") == set_id), None)
    if not related_set:
        raise ValueError("Related set not found")

    title = str(payload.get("title") or "Reference").strip() or "Reference"
    visibility = str(payload.get("visibility") or "private").strip().lower()
    if visibility not in VISIBILITIES:
        visibility = "private"

    image_bytes, ext = decode_data_url(data_url)
    ref_id = f"ref-{slugify(title)}-{uuid.uuid4().hex[:8]}"

    PRIVATE_REFERENCES.mkdir(parents=True, exist_ok=True)
    target = PRIVATE_REFERENCES / f"{ref_id}{ext}"
    target.write_bytes(image_bytes)

    reference = {
        "id": ref_id,
        "title": title,
        "creator": str(payload.get("creator") or "").strip(),
        "rights": str(payload.get("rights") or "").strip(),
        "sourceUrl": str(payload.get("sourceUrl") or "").strip(),
        "notes": str(payload.get("notes") or "").strip(),
        "visibility": visibility,
        "file": target.name,
        "originalFilename": str(payload.get("originalFilename") or "").strip(),
        "createdAt": time.strftime("%Y-%m-%d"),
    }
    master["references"].append(reference)

    related_set.setdefault("members", []).append({
        "kind": "reference",
        "id": ref_id,
        "role": str(payload.get("role") or "source").strip() or "source",
        "note": str(payload.get("memberNote") or "").strip(),
    })

    master = save_master(master)
    return master, reference


def reference_path(ref_id: str) -> Path | None:
    ref_id = str(ref_id or "").strip()
    if not ref_id:
        return None

    master = load_master()
    reference = next((item for item in master["references"] if item.get("id") == ref_id), None)
    if not reference:
        return None

    filename = Path(str(reference.get("file") or "")).name
    if not filename:
        return None

    path = PRIVATE_REFERENCES / filename
    return path if path.exists() and path.is_file() else None


def public_art_path(value: str) -> str:
    value = str(value or "").strip()
    if not value:
        return ""
    if value.startswith(("http://", "https://", "/")):
        return value
    return "/art/" + value.lstrip("/")


def active_artwork_map() -> dict[str, dict]:
    payload = read_json(ARTWORKS_PATH, {"artworks": []})
    result = {}
    for item in payload.get("artworks", []):
        if str(item.get("status", "active")).lower() in {"hidden", "deleted", "draft"}:
            continue
        artwork_id = str(item.get("id") or "").strip()
        if artwork_id:
            result[artwork_id] = item
    return result


def build_public_related() -> dict:
    # A fresh clone will not contain the private master. Preserve an existing
    # generated public projection instead of erasing it in that case.
    if not MASTER_PATH.exists():
        if PUBLIC_PATH.exists():
            return read_json(PUBLIC_PATH, {"version": 1, "sets": []})
        payload = {"version": 1, "sets": []}
        write_json(PUBLIC_PATH, payload)
        return payload

    master = load_master()
    artworks = active_artwork_map()
    references = {item["id"]: item for item in master["references"]}

    PUBLIC_REFERENCES.mkdir(parents=True, exist_ok=True)
    for child in PUBLIC_REFERENCES.iterdir():
        if child.is_file():
            child.unlink()

    public_sets = []

    for related_set in master["sets"]:
        public_members = []

        for member in related_set.get("members", []):
            kind = member.get("kind")
            member_id = member.get("id")
            role = member.get("role") or "related"
            note = member.get("note") or ""

            if kind == "artwork":
                artwork = artworks.get(member_id)
                if not artwork:
                    continue
                public_members.append({
                    "kind": "artwork",
                    "id": member_id,
                    "role": role,
                    "note": note,
                    "title": artwork.get("title") or "Untitled",
                    "collection": artwork.get("collection") or "",
                    "medium": artwork.get("medium") or "",
                    "image": public_art_path(artwork.get("image") or ""),
                    "thumb": public_art_path(artwork.get("thumb") or artwork.get("image") or ""),
                    "alt": artwork.get("alt") or artwork.get("title") or "Artwork",
                })
                continue

            if kind != "reference":
                continue

            reference = references.get(member_id)
            if not reference:
                continue

            visibility = reference.get("visibility") or "private"
            if visibility == "private":
                continue

            public_ref = {
                "kind": "reference",
                "id": member_id,
                "role": role,
                "note": note,
                "title": reference.get("title") or "Reference",
                "creator": reference.get("creator") or "",
                "rights": reference.get("rights") or "",
                "sourceUrl": reference.get("sourceUrl") or "",
                "visibility": visibility,
                "image": "",
                "thumb": "",
                "alt": reference.get("title") or "Reference image",
            }

            if visibility == "public":
                private_path = reference_path(member_id)
                if private_path:
                    public_name = f"{member_id}{private_path.suffix.lower()}"
                    public_path = PUBLIC_REFERENCES / public_name
                    shutil.copy2(private_path, public_path)
                    public_url = f"/art/assets/related/{public_name}"
                    public_ref["image"] = public_url
                    public_ref["thumb"] = public_url

            public_members.append(public_ref)

        # A public related sequence needs at least two visible members.
        if len(public_members) >= 2:
            public_sets.append({
                "id": related_set["id"],
                "title": related_set.get("title") or "Related works",
                "description": related_set.get("description") or "",
                "members": public_members,
            })

    payload = {
        "version": 1,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "sets": public_sets,
    }
    write_json(PUBLIC_PATH, payload)
    return payload


# RELATED_CANONICAL_V1
def client_reference(record: dict) -> dict:
    path = reference_path(record.get("id"))
    cache_token = ""
    if path and path.exists():
        cache_token = str(int(path.stat().st_mtime))
    return {
        "id": record.get("id"),
        "title": record.get("title") or "Reference",
        "creator": record.get("creator") or "",
        "rights": record.get("rights") or "",
        "sourceUrl": record.get("sourceUrl") or "",
        "privateNote": record.get("notes") or "",
        "visibility": record.get("visibility") or "private",
        "createdAt": record.get("createdAt") or "",
        "updatedAt": cache_token or record.get("createdAt") or "",
        "hasFile": bool(record.get("file")),
    }


def save_reference(payload: dict) -> tuple[dict, dict]:
    master = load_master()
    refs = master.setdefault("references", [])
    ref_id = str(payload.get("id") or "").strip()
    existing = None

    if ref_id:
        existing = next((r for r in refs if r.get("id") == ref_id), None)
        if not existing:
            raise KeyError("Reference not found")
    else:
        ref_id = f"ref-{uuid.uuid4().hex[:12]}"

    visibility = str(payload.get("visibility") or "private").strip().lower()
    if visibility not in VISIBILITIES:
        raise ValueError("Invalid reference visibility")

    record = dict(existing or {})
    record.update({
        "id": ref_id,
        "title": str(payload.get("title") or "Reference").strip() or "Reference",
        "creator": str(payload.get("creator") or "").strip(),
        "rights": str(payload.get("rights") or record.get("rights") or "").strip(),
        "sourceUrl": str(payload.get("sourceUrl") or "").strip(),
        "notes": str(payload.get("privateNote") or payload.get("notes") or "").strip(),
        "visibility": visibility,
        "createdAt": record.get("createdAt") or time.strftime("%Y-%m-%d"),
    })

    upload = payload.get("file")
    if isinstance(upload, dict) and upload.get("dataUrl"):
        raw, ext = decode_data_url(str(upload.get("dataUrl")))
        name = str(upload.get("name") or "")
        suffix = Path(name).suffix.lower()
        if suffix not in {".jpg",".jpeg",".png",".webp",".gif",".avif"}:
            suffix = ext

        PRIVATE_REFERENCES.mkdir(parents=True, exist_ok=True)
        filename = f"{ref_id}{suffix}"
        target = PRIVATE_REFERENCES/filename
        target.write_bytes(raw)

        old = str(record.get("file") or "")
        if old and old != filename:
            old_path = PRIVATE_REFERENCES/Path(old).name
            if old_path.exists():
                old_path.unlink()

        record["file"] = filename
        record["originalFilename"] = name

    if visibility == "public" and not record.get("file"):
        raise ValueError("Public reference images need an uploaded image")

    if existing:
        existing.clear()
        existing.update(record)
    else:
        refs.append(record)

    master = save_master(master)
    build_public_related()
    return master, record


def delete_reference_record(ref_id: str) -> tuple[dict, list[str]]:
    master = load_master()
    refs = master.setdefault("references", [])
    record = next((r for r in refs if r.get("id") == ref_id), None)
    if not record:
        raise KeyError("Reference not found")

    filename = str(record.get("file") or "")
    if filename:
        p = PRIVATE_REFERENCES/Path(filename).name
        if p.exists():
            p.unlink()

    master["references"] = [r for r in refs if r.get("id") != ref_id]
    affected=[]
    for related_set in master.get("sets", []):
        before=len(related_set.get("members",[]))
        related_set["members"]=[
            m for m in related_set.get("members",[])
            if not (m.get("kind")=="reference" and m.get("id")==ref_id)
        ]
        if len(related_set["members"]) != before:
            affected.append(related_set.get("id"))

    master=save_master(master)
    build_public_related()
    return master, affected


def save_related_set(group_id: str, title: str, raw_members, allow_duplicate=False):
    master=load_master()
    artworks=active_artwork_map()
    refs={r.get("id") for r in master.get("references",[]) if r.get("id")}
    members=[]
    seen=set()
    missing=[]

    for raw in raw_members or []:
        if isinstance(raw,str):
            member={"kind":"artwork","id":raw,"role":"related","note":""}
        elif isinstance(raw,dict):
            member={
                "kind":str(raw.get("kind") or "artwork"),
                "id":str(raw.get("id") or ""),
                "role":str(raw.get("role") or "related"),
                "note":str(raw.get("note") or ""),
            }
        else:
            continue

        if member["kind"] not in KINDS or not member["id"]:
            continue

        key=(member["kind"],member["id"])
        if key in seen:
            continue
        seen.add(key)

        if member["kind"]=="artwork" and member["id"] not in artworks:
            missing.append(f"artwork:{member['id']}")
            continue
        if member["kind"]=="reference" and member["id"] not in refs:
            missing.append(f"reference:{member['id']}")
            continue

        members.append(member)

    if missing:
        raise ValueError("Unknown related members: "+", ".join(missing))
    if len(members)<2:
        raise ValueError("A related group needs at least two members")

    sets=master.setdefault("sets",[])
    existing=None
    if group_id:
        existing=next((s for s in sets if s.get("id")==group_id),None)
        if not existing:
            raise KeyError("Related group not found")

    def signature(ms):
        return sorted(
            (str(m.get("kind") or ""),str(m.get("id") or ""))
            for m in ms if isinstance(m,dict)
        )

    duplicate=None
    if not existing:
        wanted=signature(members)
        duplicate=next((s for s in sets if signature(s.get("members",[]))==wanted),None)
        if duplicate and not allow_duplicate:
            return master, None, duplicate

    if existing:
        existing["title"]=str(title or "Related works").strip() or "Related works"
        existing["members"]=members
        group=existing
    else:
        group={
            "id":f"rel-{uuid.uuid4().hex[:12]}",
            "title":str(title or "Related works").strip() or "Related works",
            "description":"",
            "members":members,
        }
        sets.append(group)

    master=save_master(master)
    build_public_related()
    return master, group, duplicate


def delete_related_set(group_id: str) -> dict:
    master=load_master()
    sets=master.setdefault("sets",[])
    kept=[s for s in sets if s.get("id")!=group_id]
    if len(kept)==len(sets):
        raise KeyError("Related group not found")
    master["sets"]=kept
    master=save_master(master)
    build_public_related()
    return master
