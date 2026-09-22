#!/usr/bin/env python3
"""Build a self-contained, version-pinned Dark Rivers source/data release ZIP.

This is deliberately a *subproject* package. GitHub's automatic source ZIP
would contain the entire salmonofdoubt.github.io repository instead.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[3]
DEMO = ROOT / "demos" / "dark-rivers"
VERSION = "v0.1.0"
DOI = "10.5281/zenodo.22899198"
OUTPUT = ROOT / "dist" / f"dark-rivers-{VERSION}.zip"
ARCHIVE_ROOT = f"dark-rivers-{VERSION}"


def git_commit() -> str:
    return subprocess.check_output(
        ["git", "-C", str(ROOT), "rev-parse", "HEAD"], text=True
    ).strip()


def required_files() -> list[Path]:
    index = (DEMO / "index.html").read_text(encoding="utf-8")
    match = re.search(r'data-dark-rivers-version="([^"]+)"', index)
    if not match:
        raise RuntimeError("Cannot determine deployed Dark Rivers build")
    build = match.group(1)
    sources = {
        DEMO / "index.html",
        DEMO / "README.md",
        DEMO / "ops" / "build_dark_rivers.py",
        DEMO / "ops" / "test_build_dark_rivers.py",
        DEMO / "ops" / "test_production_contract.py",
        DEMO / "data" / "official.json",
        DEMO / "data" / "systems.json",
        DEMO / "data" / "network-mobile.png",
        DEMO / "icon-192.png",
        DEMO / "icon-512.png",
        DEMO / f"service-worker.{build}.js",
    }
    # Resolve the real asset names from the frozen HTML, not an obsolete list.
    for match in re.finditer(r'(?:src|href)="(\.{1,2}/[^"#?]+)"', index):
        sources.add((DEMO / match.group(1)).resolve())
    manifest = DEMO / "manifest.webmanifest"
    for icon in json.loads(manifest.read_text(encoding="utf-8"))["icons"]:
        sources.add((DEMO / icon["src"]).resolve())

    # Static data must actually be present: do not silently publish the
    # illustrative fallback as an "EPA observation" software/data snapshot.
    minimum_bytes = {
        DEMO / "data" / "official.json": 1_000_000,
        DEMO / "data" / "systems.json": 100_000,
        DEMO / "data" / "network-mobile.png": 10_000,
    }
    for file_path, minimum in minimum_bytes.items():
        if not file_path.is_file() or file_path.stat().st_size < minimum:
            raise RuntimeError(f"Required generated data missing/incomplete: {file_path}")
    for file_path in sources:
        if not file_path.is_relative_to(ROOT):
            raise RuntimeError(f"Source path escapes repository: {file_path}")
        if not file_path.is_file():
            raise RuntimeError(f"Source asset missing: {file_path}")
    return sorted(sources)


def package() -> None:
    files = required_files()
    commit = git_commit()
    index = (DEMO / "index.html").read_text(encoding="utf-8")
    build = re.search(r'data-dark-rivers-version="([^"]+)"', index).group(1)

    inventory = [
        {
            "path": path.relative_to(ROOT).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
        for path in files
    ]
    snapshot = {
        "title": "Dark Rivers",
        "release": VERSION,
        "doi": DOI,
        "doi_status_at_preparation": "reserved; publication not verified",
        "source_repository": "https://github.com/salmonofdoubt/salmonofdoubt.github.io",
        "source_commit": commit,
        "website_build": build,
        "files": inventory,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for path in files:
            relative = path.relative_to(ROOT).as_posix()
            archive.write(path, f"{ARCHIVE_ROOT}/{relative}")
        archive.writestr(
            f"{ARCHIVE_ROOT}/SNAPSHOT.json",
            json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n",
        )

    # Read the entire output back to detect a corrupt release attachment.
    with ZipFile(OUTPUT) as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError(f"ZIP integrity check failed: {bad}")
        packed = json.loads(archive.read(f"{ARCHIVE_ROOT}/SNAPSHOT.json"))
        if len(packed["files"]) != len(files):
            raise RuntimeError("ZIP inventory mismatch")
    print(f"Created: {OUTPUT}")
    print(f"Source commit: {commit}")
    print(f"Website build: {build}")
    print(f"Files: {len(files)}")
    print(f"ZIP bytes: {OUTPUT.stat().st_size}")


if __name__ == "__main__":
    package()
