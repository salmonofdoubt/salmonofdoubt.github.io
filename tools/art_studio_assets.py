"""Local Studio Assets store and independent public projection.

This deliberately does not modify the existing related-master.json, its groups,
or related-public.json. Only explicitly linked, publishable assets are exported.
"""
from __future__ import annotations

import base64
import binascii
import json
import mimetypes
import re
import shutil
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art"
INDEX = ROOT / ".art-private" / "studio" / "assets.json"
PRIVATE_FILES = INDEX.parent / "files"
PUBLIC_INDEX = ART / "data" / "studio-related.json"
PUBLIC_FILES = ART / "assets" / "studio"
ARTWORKS = ART / "data" / "artworks.json"
MAX_BYTES = 25 * 1024 * 1024

# Do not publish active content (.html, .svg, .js, etc.) on the site's origin.
PUBLIC_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif",
    ".pdf", ".txt", ".md", ".doc", ".docx", ".odt",
    ".tif", ".tiff", ".heic", ".heif", ".psd",
    ".mp3", ".m4a", ".wav", ".ogg", ".mp4", ".mov", ".webm",
}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
VIDEO_EXTENSIONS = {".mp4", ".webm"}
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".wav", ".ogg"}
MIME_OVERRIDES = {
    ".heic": "image/heic", ".heif": "image/heif", ".psd": "image/vnd.adobe.photoshop",
    ".md": "text/plain", ".m4a": "audio/mp4", ".mov": "video/quicktime",
}


def read_json(path: Path, default: dict) -> dict:
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict, backup: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if backup and path.exists():
        shutil.copy2(path, path.with_suffix(".backup.json"))
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def load_assets() -> dict:
    payload = read_json(INDEX, {"version": 1, "assets": []})
    if not isinstance(payload, dict) or not isinstance(payload.get("assets"), list):
        raise ValueError("Invalid Studio Assets index")
    return payload


def valid_artwork_ids() -> set[str]:
    data = read_json(ARTWORKS, {"artworks": []})
    return {str(a.get("id")) for a in data.get("artworks", []) if a.get("id")}


def normalise_links(raw) -> list[str]:
    if not isinstance(raw, list):
        raise ValueError("Choose artwork associations as a list")
    valid = valid_artwork_ids()
    links = []
    for item in raw:
        ident = str(item).strip()
        if ident not in valid:
            raise ValueError("Unknown artwork ID: " + ident)
        if ident not in links:
            links.append(ident)
    return links


def extension(name: str) -> str:
    # File extensions determine how files may be published, not browser MIME.
    safe_name = Path(str(name).replace("\\", "/")).name
    suffix = Path(safe_name).suffix.lower()
    if not re.fullmatch(r"\.[a-z0-9]{1,12}", suffix):
        return ".bin"
    return suffix


def mime_type(ext: str) -> str:
    return MIME_OVERRIDES.get(ext) or mimetypes.guess_type("file" + ext)[0] or "application/octet-stream"


def find_asset(ident: str) -> dict | None:
    return next((a for a in load_assets()["assets"] if a.get("id") == ident), None)


def file_for_asset(asset: dict) -> Path | None:
    filename = str(asset.get("storedName") or "")
    if not filename or Path(filename).name != filename:
        return None
    path = PRIVATE_FILES / filename
    return path if path.is_file() else None


def client_asset(asset: dict) -> dict:
    return {
        "id": asset["id"],
        "title": asset.get("title") or "",
        "note": asset.get("note") or "",
        "originalFilename": asset.get("originalFilename") or "",
        "artworkIds": asset.get("artworkIds") or [],
        "visibility": asset.get("visibility") or "private",
        "createdAt": asset.get("createdAt") or "",
        "size": asset.get("size") or 0,
        "mime": asset.get("mime") or "application/octet-stream",
        "hasFile": file_for_asset(asset) is not None,
        "publicEligible": extension(asset.get("originalFilename") or "") in PUBLIC_EXTENSIONS,
        "localUrl": "/api/studio-file/" + asset["id"],
    }


def upload_asset(payload: dict) -> dict:
    filename = Path(str(payload.get("filename") or "upload.bin").replace("\\", "/")).name
    if not filename or filename in {".", ".."}:
        raise ValueError("A filename is required")
    ext = extension(filename)
    encoded = str(payload.get("fileDataUrl") or "")
    if not encoded.startswith("data:") or ";base64," not in encoded:
        raise ValueError("Select a valid file")
    encoded = encoded.split(";base64,", 1)[1]
    if len(encoded) > (MAX_BYTES + 2) * 4 // 3 + 8:
        raise ValueError("Studio files must be 25 MB or smaller")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid file encoding") from exc
    if not data or len(data) > MAX_BYTES:
        raise ValueError("Studio files must be between 1 byte and 25 MB")
    links = normalise_links(payload.get("artworkIds") or [])
    visibility = str(payload.get("visibility") or "related")
    if visibility not in {"related", "private"}:
        raise ValueError("Invalid visibility")
    if ext not in PUBLIC_EXTENSIONS:
        visibility = "private"

    ident = "asset-" + uuid.uuid4().hex
    stored_name = ident + ext
    PRIVATE_FILES.mkdir(parents=True, exist_ok=True)
    target = PRIVATE_FILES / stored_name
    target.write_bytes(data)
    item = {
        "id": ident,
        "title": str(payload.get("title") or filename).strip()[:240],
        "note": str(payload.get("note") or "").strip()[:3000],
        "originalFilename": filename,
        "storedName": stored_name,
        "mime": mime_type(ext),
        "size": len(data),
        "artworkIds": links,
        "visibility": visibility,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    try:
        index = load_assets()
        index["assets"].append(item)
        write_json(INDEX, index, backup=True)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return item


def update_asset(payload: dict) -> dict:
    ident = str(payload.get("id") or "")
    index = load_assets()
    item = next((a for a in index["assets"] if a.get("id") == ident), None)
    if item is None:
        raise KeyError("Studio asset not found")
    if "title" in payload:
        item["title"] = str(payload["title"]).strip()[:240] or item["originalFilename"]
    if "note" in payload:
        item["note"] = str(payload["note"]).strip()[:3000]
    if "artworkIds" in payload:
        item["artworkIds"] = normalise_links(payload["artworkIds"])
    if "visibility" in payload:
        visibility = str(payload["visibility"])
        if visibility not in {"related", "private"}:
            raise ValueError("Invalid visibility")
        if visibility == "related" and extension(item["originalFilename"]) not in PUBLIC_EXTENSIONS:
            raise ValueError("This file type must remain private for site security")
        item["visibility"] = visibility
    write_json(INDEX, index, backup=True)
    return item



def bulk_link_assets(payload: dict) -> dict:
    """Atomically add/remove artwork links for multiple Studio Assets.

    Do not replace any pre-existing links. Do not alter legacy related groups.
    Privacy is unchanged unless the user expressly opts into public visibility.
    Validation completes before any metadata is written.
    """
    raw_assets = payload.get("assetIds")
    if not isinstance(raw_assets, list) or not (1 <= len(raw_assets) <= 500):
        raise ValueError("Select between 1 and 500 Studio Assets")
    asset_ids = []
    for value in raw_assets:
        if not isinstance(value, str) or not value.startswith("asset-"):
            raise ValueError("Invalid Studio Asset ID")
        if value not in asset_ids:
            asset_ids.append(value)

    work_ids = normalise_links(payload.get("artworkIds"))
    if not work_ids:
        raise ValueError("Select at least one target artwork")

    action = str(payload.get("action") or "add")
    if action not in {"add", "remove"}:
        raise ValueError("Action must be add or remove")
    public = payload.get("makeRelated", False)
    if not isinstance(public, bool):
        raise ValueError("makeRelated must be true or false")
    if action != "add" and public:
        raise ValueError("Cannot publish assets during unlink")

    index = load_assets()
    by_id = {entry.get("id"): entry for entry in index["assets"]}
    missing = [ident for ident in asset_ids if ident not in by_id]
    if missing:
        raise ValueError("Unknown Studio Asset ID: " + missing[0])

    if public:
        for ident in asset_ids:
            asset = by_id[ident]
            if extension(asset.get("originalFilename") or "") not in PUBLIC_EXTENSIONS:
                raise ValueError("File type cannot be published: " +
                                 str(asset.get("originalFilename") or ident))
            if file_for_asset(asset) is None:
                raise ValueError("Missing local asset file: " + ident)

    changed = 0
    # Applying changes to index does not persist anything until write_json.
    for ident in asset_ids:
        asset = by_id[ident]
        before = list(asset.get("artworkIds") or [])
        previously_private = asset.get("visibility") != "related"
        if action == "add":
            asset["artworkIds"] = before + [work for work in work_ids if work not in before]
            if public:
                asset["visibility"] = "related"
        else:
            asset["artworkIds"] = [work for work in before if work not in work_ids]
        if asset["artworkIds"] != before or (public and previously_private):
            changed += 1
    write_json(INDEX, index, backup=True)
    return {"selectedCount": len(asset_ids), "changedCount": changed,
            "artworkIds": work_ids, "action": action, "madePublic": public}


def validate_publication(ids: list[str]) -> None:
    current = {item.get("id"): item for item in load_assets()["assets"]}
    for ident in ids:
        item = current.get(ident)
        if item is None:
            raise ValueError("Studio Asset not found: " + ident)
        if extension(item.get("originalFilename") or "") not in PUBLIC_EXTENSIONS:
            raise ValueError("Studio file cannot be published: " + str(item.get("originalFilename")))
        if file_for_asset(item) is None:
            raise ValueError("Studio file is missing: " + ident)


def publish_assets(ids: list[str]) -> None:
    """Explicit user opt-in to show selected Studio files in canonical Related groups."""
    validate_publication(ids)
    index = load_assets()
    wanted = set(ids)
    changed = False
    for item in index["assets"]:
        if item.get("id") in wanted and item.get("visibility") != "related":
            item["visibility"] = "related"
            changed = True
    if changed:
        write_json(INDEX, index, backup=True)


def delete_asset(ident: str) -> None:
    index = load_assets()
    item = next((a for a in index["assets"] if a.get("id") == ident), None)
    if not item:
        raise KeyError("Studio asset not found")
    index["assets"] = [a for a in index["assets"] if a.get("id") != ident]
    write_json(INDEX, index, backup=True)
    target = file_for_asset(item)
    if target:
        target.unlink()


def artwork_public_path(value: str) -> str:
    value = str(value or "").strip()
    if not value or value.startswith(("http://", "https://", "/")):
        return value
    return "/art/" + value.lstrip("/")


def build_public_studio() -> dict:
    # GitHub builds don't have the ignored local store. Never overwrite a
    # previously published projection when the source index is absent.
    if not INDEX.exists():
        return read_json(PUBLIC_INDEX, {"version": 1, "sets": []})

    index = load_assets()
    artworks = read_json(ARTWORKS, {"artworks": []}).get("artworks", [])
    active = {a["id"]: a for a in artworks
              if a.get("id") and str(a.get("status") or "active").lower() not in
              {"hidden", "deleted", "draft"}}
    PUBLIC_FILES.mkdir(parents=True, exist_ok=True)
    all_sets = []
    desired_files = set()
    for art_id, artwork in active.items():
        members = []
        for asset in index["assets"]:
            if asset.get("visibility") != "related" or art_id not in asset.get("artworkIds", []):
                continue
            src = file_for_asset(asset)
            if src is None or src.suffix.lower() not in PUBLIC_EXTENSIONS:
                continue
            desired_files.add(src.name)
            dest = PUBLIC_FILES / src.name
            if not dest.exists() or dest.stat().st_size != src.stat().st_size:
                shutil.copy2(src, dest)
            ext = src.suffix.lower()
            members.append({
                "kind": "studio",
                "id": asset["id"],
                "title": asset.get("title") or "Studio material",
                "note": asset.get("note") or "",
                "originalFilename": asset.get("originalFilename") or "",
                "image": "/art/assets/studio/" + src.name,
                "thumb": "/art/assets/studio/" + src.name if ext in IMAGE_EXTENSIONS else "",
                "mime": asset.get("mime") or mime_type(ext),
                "mediaKind": "image" if ext in IMAGE_EXTENSIONS else
                             "video" if ext in VIDEO_EXTENSIONS else
                             "audio" if ext in AUDIO_EXTENSIONS else "file",
            })
        if members:
            all_sets.append({
                "id": "studio:" + art_id,
                "title": "Studio materials · " + str(artwork.get("title") or "Untitled"),
                "members": [
                    {"kind": "artwork", "id": art_id,
                     "title": artwork.get("title") or "Untitled",
                     "collection": artwork.get("collection") or "",
                     "medium": artwork.get("medium") or "",
                     "image": artwork_public_path(artwork.get("image")),
                     "thumb": artwork_public_path(artwork.get("thumb") or artwork.get("image")),
                     "alt": artwork.get("alt") or artwork.get("title") or "Artwork"},
                    *members,
                ],
            })
    # Canonical Related groups may include Studio members without generating a
    # second per-artwork Studio relationship. Their published blobs must survive
    # the Studio projection's pruning stage and be copied exactly once.
    from art_related import load_master
    for group in load_master().get("sets", []):
        if not any(member.get("kind") == "artwork" and
                   member.get("id") in active for member in group.get("members", [])):
            continue
        for member in group.get("members", []):
            if member.get("kind") != "studio":
                continue
            item = next((a for a in index["assets"] if a.get("id") == member.get("id")), None)
            if not item or item.get("visibility") != "related":
                continue
            src = file_for_asset(item)
            if src is None or src.suffix.lower() not in PUBLIC_EXTENSIONS:
                continue
            desired_files.add(src.name)
            dst = PUBLIC_FILES / src.name
            if not dst.exists() or dst.stat().st_size != src.stat().st_size:
                shutil.copy2(src, dst)

    # Only this feature's namespaced blobs are ever removed; no existing
    # published artwork or related-reference file is altered.
    for path in PUBLIC_FILES.iterdir():
        if path.is_file() and path.name.startswith("asset-") and path.name not in desired_files:
            path.unlink()
    result = {"version": 1, "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
              "sets": all_sets}
    write_json(PUBLIC_INDEX, result)
    return result
