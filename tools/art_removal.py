"""Conservative exact-duplicate review and recoverable ARTS removal.

Gallery, Studio and legacy Ref records share one Remove/Undo workflow.
Nothing is deleted automatically. Originals are copied into ignored local
Trash BEFORE metadata updates, and archived records can be restored.
"""
from __future__ import annotations

import copy
import hashlib
import json
import shutil
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import art_related as related
import art_studio_assets as studio
import art_transfer as transfer

TRASH_DIR = transfer.ROOT / ".art-private" / "trash"
TRASH_INDEX = TRASH_DIR / "records.json"
TRASH_FILES = TRASH_DIR / "files"
_LOCK = threading.RLock()


def _safe_path(raw: str) -> Path | None:
    if not raw or raw.startswith(("http://", "https://")):
        return None
    text = raw.split("?", 1)[0]
    if text.startswith("/art/"):
        text = text[5:]
    elif text.startswith("art/"):
        text = text[4:]
    elif text.startswith("/"):
        return None
    file = (transfer.ART / text).resolve()
    if not file.is_relative_to(transfer.ROOT.resolve()) or file.is_symlink():
        return None
    return file if file.is_file() else None


def _file_for(kind: str, record: dict) -> Path | None:
    if kind == "gallery":
        return _safe_path(str(record.get("image") or ""))
    if kind == "studio":
        return studio.file_for_asset(record)
    if kind == "reference":
        return related.reference_path(str(record.get("id") or ""))
    return None


def _url_key(value: str) -> str | None:
    value = str(value or "").strip()
    if not value.startswith(("https://", "http://")):
        return None
    try:
        parts = urlsplit(value)
        if not parts.hostname:
            return None
        return urlunsplit((parts.scheme.lower(), parts.netloc.lower(),
                           parts.path, "", ""))
    except ValueError:
        return None


def _all_records() -> list[tuple[str, dict]]:
    data = transfer.read(transfer.ARTWORKS, {"artworks": []})
    assets = studio.load_assets()
    refs = related.load_master()
    return ([( "gallery", r) for r in data.get("artworks", [])] +
            [( "studio", r) for r in assets["assets"]] +
            [( "reference", r) for r in refs["references"]])


def exact_duplicates() -> list[dict]:
    """Report ONLY exact bytes or the same original media URL.

    Identical titles, filenames or visual appearance are never considered
    proof of duplication. This never fetches remote photographs.
    """
    records = _all_records()
    parents = list(range(len(records)))

    def root(i: int) -> int:
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    def union(i: int, j: int) -> None:
        ri, rj = root(i), root(j)
        if ri != rj:
            parents[rj] = ri

    previous: dict[str, int] = {}
    digests: dict[str, str] = {}
    for i, (kind, record) in enumerate(records):
        path = _file_for(kind, record)
        keys: list[str] = []
        if path and path.is_file():
            # A streamed digest avoids holding large originals in memory.
            sha = hashlib.sha256()
            with path.open("rb") as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b""):
                    sha.update(block)
            fingerprint = sha.hexdigest()
            digests[f"{kind}:{record['id']}"] = fingerprint
            keys.append("bytes:" + fingerprint)
        if kind == "gallery":
            key = _url_key(record.get("image") or "")
            if key:
                keys.append("url:" + key)
        elif kind == "studio":
            key = _url_key(record.get("originRemoteImage") or "")
            if key:
                keys.append("url:" + key)
        for key in keys:
            if key in previous:
                union(i, previous[key])
            else:
                previous[key] = i

    clusters: dict[int, list[int]] = {}
    for i in range(len(records)):
        clusters.setdefault(root(i), []).append(i)

    master = related.load_master()
    counts = {
        (m.get("kind"), m.get("id")): 0
        for group in master["sets"] for m in group.get("members", [])
    }
    for group in master["sets"]:
        for m in group.get("members", []):
            k = (m.get("kind"), m.get("id"))
            counts[k] = counts.get(k, 0) + 1

    groups = []
    for positions in clusters.values():
        if len(positions) < 2:
            continue
        members = []
        all_digests = []
        for index in positions:
            kind, r = records[index]
            ident = str(r.get("id") or "")
            fingerprint = digests.get(f"{kind}:{ident}")
            if fingerprint:
                all_digests.append(fingerprint)
            members.append({
                "kind": kind,
                "id": ident,
                "title": r.get("title") or r.get("originalFilename") or "Untitled",
                "location": (r.get("collection") or "Gallery") if kind == "gallery"
                            else ("Studio · Ref" if kind == "reference" or r.get("isReference") else "Studio"),
                "image": (r.get("thumb") or r.get("image") or "") if kind == "gallery"
                         else ("/api/reference-image/" + ident if kind == "reference" else
                               "/api/studio-file/" + ident),
                "hasFile": _file_for(kind, r) is not None,
                "relatedGroups": counts.get(("artwork" if kind == "gallery" else kind, ident), 0),
            })
        groups.append({
            "id": "match-" + str(len(groups) + 1),
            "match": "Identical image files" if len(all_digests) == len(members) and
                     len(set(all_digests)) == 1 else "Same original image URL",
            "items": members,
        })
    groups.sort(key=lambda g: (-len(g["items"]), g["items"][0]["title"].casefold()))
    return groups


def _trash_index() -> dict:
    if not TRASH_INDEX.is_file():
        return {"version": 1, "items": []}
    data = json.loads(TRASH_INDEX.read_text("utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        raise ValueError("Private Trash index is damaged. Restore it from a backup before removing anything.")
    return data


def recent_removed() -> list[dict]:
    with _LOCK:
        items = _trash_index()["items"]
        return [{"trashId": item["trashId"], "title": item.get("title") or "",
                 "kind": item["kind"], "removedAt": item.get("removedAt") or ""}
                for item in reversed(items) if not item.get("restored")][:10]


def _is_shared(path: Path | None, records: list[tuple[str, dict]], excluding: tuple[str, str]) -> bool:
    if not path:
        return False
    for kind, item in records:
        if (kind, str(item.get("id") or "")) == excluding:
            continue
        if kind == "gallery":
            values = [item.get("image") or "", item.get("thumb") or ""]
            if any(_safe_path(v) == path for v in values):
                return True
        elif _file_for(kind, item) == path:
            return True
    return False


def _links(master: dict, kind: str, ident: str) -> list[dict]:
    key = "artwork" if kind == "gallery" else kind
    found = []
    for group in master.get("sets", []):
        for i, member in enumerate(group.get("members", [])):
            if member.get("kind") == key and member.get("id") == ident:
                found.append({"groupId": group["id"], "index": i, "member": copy.deepcopy(member)})
    return found


def remove_item(kind: str, ident: str) -> dict:
    """Archive one explicitly chosen item and detach its relationships.

    A metadata operation may fail without deleting the source: archive image
    is made and verified first. Originals outside managed folders are
    deliberately retained.
    """
    if kind not in {"gallery", "studio", "reference"} or not isinstance(ident, str) or not ident:
        raise ValueError("Choose an actual Gallery or Studio item")
    with _LOCK:
        gallery = transfer.read(transfer.ARTWORKS, {"artworks": []})
        assets = studio.load_assets()
        master = related.load_master()
        curation = transfer.read(transfer.CURATION, {"homepageHero": {}, "collections": {}})
        trash = _trash_index()

        records_by_kind = {
            "gallery": gallery.get("artworks", []),
            "studio": assets["assets"],
            "reference": master["references"],
        }
        records = records_by_kind[kind]
        position = next((i for i, r in enumerate(records) if r.get("id") == ident), -1)
        if position < 0:
            raise KeyError("Item not found. Refresh ARTS Manager.")
        record = copy.deepcopy(records[position])
        # Do not touch legacy public relationships if their private master is
        # not restored on this Mac.
        if not related.MASTER_PATH.is_file() and kind == "gallery":
            public = transfer.read(related.PUBLIC_PATH, {"sets": []})
            if any(m.get("kind") == "artwork" and m.get("id") == ident
                   for g in public.get("sets", []) for m in g.get("members", [])):
                raise ValueError("Restore your private Related archive before removing this linked artwork.")

        source = _file_for(kind, record)
        if kind == "studio" and source is None and record.get("storedName"):
            raise ValueError("Studio original is missing. Restore it before removing this item.")
        if kind == "reference" and source is None and record.get("file"):
            raise ValueError("Reference original is missing. Restore it before removing this item.")

        trash_id = "trash-" + uuid.uuid4().hex
        copied_name = ""
        if source:
            TRASH_FILES.mkdir(parents=True, exist_ok=True)
            target = TRASH_FILES / (trash_id + source.suffix.lower())
            shutil.copy2(source, target)
            if hashlib.sha256(source.read_bytes()).digest() != hashlib.sha256(target.read_bytes()).digest():
                target.unlink(missing_ok=True)
                raise ValueError("Cannot verify the private Trash copy; nothing was removed.")
            copied_name = target.name
        original_rel = str(source.relative_to(transfer.ROOT.resolve())) if source else ""
        source_records = _all_records()
        shared = _is_shared(source, source_records, (kind, ident))
        # Only remove a public Gallery image when it is in our own managed
        # image folder. Never erase shared, WordPress or legacy images.
        managed_gallery = (source is not None and kind == "gallery"
                           and source.is_relative_to((transfer.ART / "assets/works").resolve()))
        can_unlink = source is not None and not shared and (
            managed_gallery or kind in {"studio", "reference"}
        )
        links = _links(master, kind, ident)
        key = "artwork" if kind == "gallery" else kind
        for group in master["sets"]:
            group["members"] = [
                member for member in group.get("members", [])
                if not (member.get("kind") == key and member.get("id") == ident)
            ]
        records.pop(position)
        hero_before: list[dict] = []
        if kind == "gallery":
            hero = curation.get("homepageHero") or {}
            if hero.get("id") == ident or hero.get("image") == record.get("image"):
                hero_before.append({"location": "homepageHero", "value": copy.deepcopy(hero)})
                curation["homepageHero"] = {}
            for collection_name, col in curation.get("collections", {}).items():
                feat = col.get("feature") or {}
                if feat.get("id") == ident or feat.get("image") == record.get("image"):
                    hero_before.append({"location": collection_name, "value": copy.deepcopy(feat)})
                    col.pop("feature", None)
            # Direct artwork associations on Studio files may still point to
            # the removed work; save and detach them too.
            detached = []
            for asset in assets["assets"]:
                if ident in asset.get("artworkIds", []):
                    detached.append({"id": asset["id"], "ids": copy.deepcopy(asset["artworkIds"])})
                    asset["artworkIds"] = [x for x in asset["artworkIds"] if x != ident]
        else:
            detached = []
        entry = {
            "trashId": trash_id, "kind": kind, "title": record.get("title") or "Untitled",
            "record": record, "index": position, "media": copied_name,
            "originalRel": original_rel, "links": links, "features": hero_before,
            "studioLinks": detached, "removedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "restored": False,
        }
        trash["items"].append(entry)
        updates: list[tuple[Path, dict]] = [(TRASH_INDEX, trash)]
        if kind == "gallery":
            updates.append((transfer.ARTWORKS, gallery))
            updates.append((transfer.CURATION, curation))
        if kind in {"studio", "gallery"}:
            if studio.INDEX.is_file():
                updates.append((studio.INDEX, assets))
        if related.MASTER_PATH.is_file():
            updates.append((related.MASTER_PATH, master))
        # Committing JSON is one protected operation; any exception rolls
        # back the prior metadata snapshot.
        transfer.apply_changes(updates)
        retained = False
        if can_unlink and source:
            try:
                source.unlink()
            except OSError:
                retained = True
        elif source and not (kind == "studio" or kind == "reference"):
            retained = True
        warnings = []
        if kind == "gallery" and str(record.get("image") or "").startswith(("http://", "https://")):
            warnings.append("The original image remains hosted on its external website.")
        elif retained:
            warnings.append("The original file is shared or outside managed artwork storage, so it remains on disk.")
        warnings.append("Previously published copies may remain in Git history or browser caches.")
        return {
            "trashId": trash_id, "removed": {"kind": kind, "id": ident, "title": entry["title"]},
            "affectedGroups": len(links), "warnings": warnings,
        }


def restore_item(trash_id: str) -> dict:
    with _LOCK:
        trash = _trash_index()
        entry = next((x for x in trash["items"] if x.get("trashId") == trash_id
                      and not x.get("restored")), None)
        if not entry:
            raise KeyError("Removed item not found in local Trash")
        kind = entry["kind"]
        record = copy.deepcopy(entry["record"])
        gallery = transfer.read(transfer.ARTWORKS, {"artworks": []})
        assets = studio.load_assets()
        master = related.load_master()
        curation = transfer.read(transfer.CURATION, {"homepageHero": {}, "collections": {}})
        by_kind = {
            "gallery": gallery.get("artworks", []),
            "studio": assets["assets"],
            "reference": master["references"],
        }
        dest = by_kind[kind]
        if any(x.get("id") == record.get("id") for x in dest):
            raise ValueError("An item with this ID already exists. No restore was attempted.")

        media = entry.get("media") or ""
        original_rel = entry.get("originalRel") or ""
        if media and original_rel:
            source = TRASH_FILES / Path(media).name
            restored = (transfer.ROOT / original_rel).resolve()
            if not restored.is_relative_to(transfer.ROOT.resolve()) or restored.is_symlink():
                raise ValueError("Unsafe restore path")
            if not source.is_file():
                raise ValueError("Private Trash copy is missing. Restore your backup.")
            if restored.is_file() and hashlib.sha256(restored.read_bytes()).digest() != hashlib.sha256(source.read_bytes()).digest():
                raise ValueError("A different file already exists at the original path")
            if not restored.is_file():
                restored.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, restored)

        dest.insert(min(int(entry.get("index", len(dest))), len(dest)), record)
        for link in entry.get("links", []):
            group = next((g for g in master["sets"] if g.get("id") == link["groupId"]), None)
            if group and not any(m.get("kind") == link["member"]["kind"] and
                                 m.get("id") == link["member"]["id"] for m in group["members"]):
                group["members"].insert(min(link["index"], len(group["members"])), link["member"])
        for feature in entry.get("features", []):
            if feature["location"] == "homepageHero":
                if not curation.get("homepageHero"):
                    curation["homepageHero"] = feature["value"]
            else:
                col = curation.setdefault("collections", {}).setdefault(feature["location"], {})
                if not col.get("feature"):
                    col["feature"] = feature["value"]
        for link in entry.get("studioLinks", []):
            item = next((a for a in assets["assets"] if a.get("id") == link["id"]), None)
            if item:
                item["artworkIds"] = list(dict.fromkeys(item.get("artworkIds", []) + link["ids"]))
        entry["restored"] = True
        updates: list[tuple[Path, dict]] = [(TRASH_INDEX, trash)]
        if kind == "gallery":
            updates.extend([(transfer.ARTWORKS, gallery), (transfer.CURATION, curation)])
        if kind in {"gallery", "studio"} and studio.INDEX.is_file():
            updates.append((studio.INDEX, assets))
        if related.MASTER_PATH.is_file():
            updates.append((related.MASTER_PATH, master))
        transfer.apply_changes(updates)
        return {"kind": kind, "id": record["id"], "title": record.get("title") or "Untitled"}
