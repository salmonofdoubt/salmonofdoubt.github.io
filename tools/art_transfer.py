"""Reversible transfers between an exhibited artwork and the local-only Studio.

No existing artwork or Studio Asset is silently deleted. Studio is PRIVATE
on transfer, and an artwork's entire record is kept for restoring it later.
"""
from __future__ import annotations

import copy
import hashlib
import json
import mimetypes
import re
import shutil
import time
import uuid
from pathlib import Path

import art_related as related
import art_studio_assets as studio

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art"
ARTWORKS = ART / "data" / "artworks.json"
CURATION = ART / "data" / "art-curation.json"
COLLECTIONS = {
    "Oil Paintings": "oil-paintings", "Watercolours": "watercolours",
    "Drawings": "drawings", "Experimental": "experimental",
    "GeoSpatial Imagery": "geospatial-imagery",
}
IMAGES = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}


def read(path: Path, fallback: dict) -> dict:
    return json.loads(path.read_text("utf-8")) if path.is_file() else copy.deepcopy(fallback)


def write(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        shutil.copy2(path, path.with_name(path.name + ".backup.json"))
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", "utf-8")
    tmp.replace(path)


def source_path(record: dict) -> tuple[Path, str]:
    raw = str(record.get("image") or "").split("?", 1)[0]
    raw = raw.removeprefix("/art/").removeprefix("art/")
    if not raw or raw.startswith(("/", "\\")) or ".." in Path(raw).parts:
        raise ValueError("This artwork does not have a safe local image. Download the original first.")
    candidate = ART / raw
    if not candidate.is_file() or candidate.is_symlink() or not candidate.resolve().is_relative_to(ART.resolve()):
        raise ValueError("The artwork image is missing from the local checkout. Restore it before moving.")
    ext = candidate.suffix.lower()
    if ext not in IMAGES:
        raise ValueError("Only gallery images can be moved; this item's format is unsupported.")
    return candidate, raw


def rewrite_members(master: dict, old_kind: str, old_id: str, new_kind: str, new_id: str) -> None:
    for group in master.get("sets", []):
        for member in group.get("members", []):
            if member.get("kind") == old_kind and member.get("id") == old_id:
                member["kind"], member["id"] = new_kind, new_id


def apply_changes(payloads: list[tuple[Path, dict]]) -> None:
    """Restore source metadata on a partial failure; never remove source images here."""
    originals = {path: path.read_bytes() if path.is_file() else None for path, _ in payloads}
    try:
        for path, value in payloads:
            write(path, value)
    except Exception:
        for path, raw in originals.items():
            if raw is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(raw)
        raise


def to_studio(art_id: str) -> dict:
    artworks = read(ARTWORKS, {"artworks": []})
    entries = artworks.get("artworks", [])
    record = next((a for a in entries if a.get("id") == art_id), None)
    if record is None:
        raise ValueError("Artwork not found in the Gallery")
    image, original_path = source_path(record)
    index = studio.load_assets()
    if any(a.get("originArtwork", {}).get("id") == art_id for a in index["assets"]):
        raise ValueError("This artwork already has a saved Studio version")

    asset_id = "asset-" + uuid.uuid4().hex
    extension = image.suffix.lower()
    studio.PRIVATE_FILES.mkdir(parents=True, exist_ok=True)
    private_copy = studio.PRIVATE_FILES / (asset_id + extension)
    shutil.copy2(image, private_copy)
    content = private_copy.read_bytes()
    if hashlib.sha256(image.read_bytes()).digest() != hashlib.sha256(content).digest():
        private_copy.unlink(missing_ok=True)
        raise ValueError("The private image copy could not be verified; original remains unchanged")

    shared = any(other is not record and original_path in
                 {str(other.get("image") or "").removeprefix("/art/"),
                  str(other.get("thumb") or "").removeprefix("/art/")}
                 for other in entries)
    # Never delete an image referenced by a second artwork or outside managed
    # upload directory. Original Git history cannot be removed by this move.
    remove_public = original_path.startswith("assets/works/") and not shared
    asset = {
        "id": asset_id, "title": record.get("title") or image.stem,
        "note": record.get("text") or record.get("reading") or "",
        "originalFilename": image.name, "storedName": private_copy.name,
        "mime": mimetypes.guess_type(image.name)[0] or "image/jpeg",
        "size": len(content), "visibility": "private", "artworkIds": [],
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "originArtwork": copy.deepcopy(record),
        "originPublicRemoved": remove_public,
    }
    master = related.load_master()
    rewrite_members(master, "artwork", art_id, "studio", asset_id)
    curation = read(CURATION, {"homepageHero": {}, "collections": {}})
    hero = curation.get("homepageHero") or {}
    if hero.get("id") == art_id or hero.get("image") == record.get("image"):
        curation["homepageHero"] = {}
    for collection in curation.get("collections", {}).values():
        featured = collection.get("feature") or {}
        if featured.get("id") == art_id or featured.get("image") == record.get("image"):
            collection.pop("feature", None)
    artworks["artworks"] = [a for a in entries if a.get("id") != art_id]
    index["assets"].append(asset)

    mutations = [(ARTWORKS, artworks), (studio.INDEX, index), (CURATION, curation)]
    if related.MASTER_PATH.is_file():
        mutations.append((related.MASTER_PATH, master))
    try:
        apply_changes(mutations)
    except Exception:
        private_copy.unlink(missing_ok=True)
        raise
    if remove_public:
        image.unlink()  # already copied and verified; metadata is safely saved.
    return {"id": asset_id, "title": asset["title"], "destination": "Studio",
            "publicImageRemoved": remove_public,
            "warning": "Previously published files may remain in Git history, caches or external archives."}


def to_gallery(asset_id: str, collection: str) -> dict:
    if collection not in COLLECTIONS:
        raise ValueError("Choose one of the five Gallery Rooms")
    index = studio.load_assets()
    asset = next((a for a in index["assets"] if a.get("id") == asset_id), None)
    if asset is None:
        raise ValueError("Studio Asset not found")
    source = studio.file_for_asset(asset)
    if source is None or source.suffix.lower() not in IMAGES:
        raise ValueError("This Studio item is not a publishable image")
    artworks = read(ARTWORKS, {"artworks": []})
    saved = asset.get("originArtwork")
    if isinstance(saved, dict) and saved.get("id"):
        new_record = copy.deepcopy(saved)
        new_record["collection"] = collection
        art_id = new_record["id"]
        target_rel = str(new_record.get("image") or "").removeprefix("/art/")
        # Only restore to a verified Gallery-relative file path.
        if target_rel.startswith("art/"):
            target_rel = target_rel[4:]
        if not target_rel or Path(target_rel).is_absolute() or ".." in Path(target_rel).parts:
            raise ValueError("Saved artwork contains an invalid image path")
        target = ART / target_rel
        if not target.resolve().is_relative_to(ART.resolve()):
            raise ValueError("Invalid Gallery image destination")
    else:
        art_id = COLLECTIONS[collection] + "-studio-" + uuid.uuid4().hex[:12]
        filename = re.sub(r"[^a-z0-9-]", "-", (asset.get("title") or "study").lower()).strip("-")[:60] or "study"
        target_rel = "assets/works/" + COLLECTIONS[collection] + "/" + filename + "-" + uuid.uuid4().hex[:8] + source.suffix.lower()
        target = ART / target_rel
        new_record = {
            "id": art_id, "title": asset.get("title") or "Untitled",
            "collection": collection, "collectionOrder": 999,
            "subgroup": "Other", "medium": collection, "image": target_rel,
            "thumb": target_rel, "source": "Studio Assets",
            "sourceUrl": target_rel, "alt": asset.get("title") or "Artwork",
            "text": asset.get("note") or "", "reading": asset.get("note") or "",
            "status": "active", "createdAt": time.strftime("%Y-%m-%d"),
        }
    if any(a.get("id") == art_id for a in artworks["artworks"]):
        raise ValueError("This artwork ID already exists; no file was moved")
    if target.is_file():
        if hashlib.sha256(target.read_bytes()).digest() != hashlib.sha256(source.read_bytes()).digest():
            raise ValueError("A different file already occupies this Gallery path")
    elif target.is_symlink():
        raise ValueError("Refusing a symlink as the Gallery destination")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    newly_copied = target.is_file() and target.read_bytes() == source.read_bytes() and not bool(saved and not asset.get("originPublicRemoved"))
    master = related.load_master()
    rewrite_members(master, "studio", asset_id, "artwork", art_id)
    artworks["artworks"].append(new_record)
    index["assets"] = [item for item in index["assets"] if item.get("id") != asset_id]
    modifications = [(ARTWORKS, artworks), (studio.INDEX, index)]
    if related.MASTER_PATH.is_file():
        modifications.append((related.MASTER_PATH, master))
    apply_changes(modifications)
    # The original Studio image remains in the local private folder as an
    # extra emergency copy, but is no longer a listed Studio Asset.
    return {"id": art_id, "title": new_record["title"], "destination": collection,
            "privateCopyRetained": True}
