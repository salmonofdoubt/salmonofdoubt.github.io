"""One local Studio view over BOTH existing private stores.

No migration, deletion or copying of existing references takes place.
The old reference IDs and canonical Related group memberships stay intact.
This is intentionally an adapter, not a third archive.
"""
from __future__ import annotations

import mimetypes
from pathlib import Path

import art_related as related
import art_studio_assets as studio


def client_reference(record: dict) -> dict:
    """Represent old, private Related references as ordinary Studio cards."""
    ident = str(record.get("id") or "")
    path = related.reference_path(ident)
    name = str(record.get("originalFilename") or record.get("file") or "Reference")
    ext = Path(name).suffix.lower()
    return {
        "id": ident,
        "kind": "reference",  # Legacy relation ID, never silently rewritten
        "isReference": record.get("isReference", True) is not False,
        "title": record.get("title") or "Reference",
        "note": record.get("notes") or "",
        "originalFilename": name,
        "mime": mimetypes.guess_type(name)[0] or "application/octet-stream",
        "hasFile": path is not None,
        "size": path.stat().st_size if path is not None else 0,
        "sortOrder": record.get("sortOrder"),
        "visibility": "related" if record.get("visibility") == "public" else "private",
        "legacyVisibility": record.get("visibility") or "private",
        "localUrl": "/api/reference-image/" + ident,
        "publicEligible": path is not None and path.suffix.lower() in studio.IMAGE_EXTENSIONS,
        "artworkIds": [],
        "movedFromGallery": False,
        "originCollection": "",
        "createdAt": record.get("createdAt") or "",
    }


def all_items() -> list[dict]:
    regular = []
    for record in studio.load_assets()["assets"]:
        item = studio.client_asset(record)
        item["kind"] = "studio"
        regular.append(item)
    older = [
        client_reference(record)
        for record in related.load_master().get("references", [])
    ]
    return regular + older


def update_legacy_reference(payload: dict) -> dict:
    """Only change a reference's displayed Studio label and description.

    Does not change its established public/private setting, rights, source
    attribution or existing related groups.
    """
    ident = str(payload.get("id") or "")
    master = related.load_master()
    item = next((r for r in master["references"] if r.get("id") == ident), None)
    if item is None:
        raise KeyError("Studio reference not found")
    if "title" in payload:
        item["title"] = str(payload["title"]).strip()[:240] or "Reference"
    if "note" in payload:
        item["notes"] = str(payload["note"]).strip()[:3000]
    if "isReference" in payload:
        if not isinstance(payload["isReference"], bool):
            raise ValueError("Reference marker must be true or false")
        item["isReference"] = payload["isReference"]
    related.save_master(master)
    return client_reference(item)


def reorder_all(ordered_ids: list[str]) -> dict:
    """Persist Studio and legacy references in one drag-and-drop sequence."""
    assets = studio.load_assets()
    master = related.load_master()
    raw = assets["assets"] + master["references"]
    original_ids = [str(item.get("id")) for item in raw]
    if (not isinstance(ordered_ids, list) or
            len(ordered_ids) != len(original_ids) or
            any(not isinstance(v, str) for v in ordered_ids) or
            len(set(ordered_ids)) != len(ordered_ids) or
            set(ordered_ids) != set(original_ids)):
        raise ValueError("Studio order has changed. Refresh and try again.")
    ranks = {ident: (i + 1) * 10 for i, ident in enumerate(ordered_ids)}
    if not raw:
        return {"count": 0}
    # Snapshot both indexes; in the unlikely event the second write fails,
    # revert the first and keep an independent backup.
    snapshots = {}
    targets = []
    if assets["assets"]:
        targets.append(studio.INDEX)
    if master["references"]:
        targets.append(related.MASTER_PATH)
    for path in targets:
        snapshots[path] = path.read_bytes() if path.is_file() else None
    try:
        if assets["assets"]:
            for item in assets["assets"]:
                item["sortOrder"] = ranks[item["id"]]
            assets["assets"].sort(key=lambda x: ranks[x["id"]])
            studio.write_json(studio.INDEX, assets, backup=True)
        if master["references"]:
            for item in master["references"]:
                item["sortOrder"] = ranks[item["id"]]
            related.save_master(master)
    except Exception:
        for path, content in snapshots.items():
            if content is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(content)
        raise
    return {"count": len(original_ids)}
