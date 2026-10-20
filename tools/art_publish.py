"""Controlled Save → Review → Commit → Publish for the LOCAL ARTS Manager.

This module never pushes implicitly. Git staging is limited to public gallery
output and never includes ignored originals, credentials, or unrelated projects.
Every mutation requires a fresh, server-minted review token.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import subprocess
import threading
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
SITE_REPO = "salmonofdoubt/salmonofdoubt.github.io"
COLLECTION_SLUGS = {
    "oil-paintings", "watercolours", "drawings",
    "experimental", "geospatial-imagery",
}
PUBLIC_FILES = {
    "art/data/artworks.json", "art/data/art-curation.json",
    "art/data/related-public.json", "art/data/studio-related.json",
    "art/index.html",
} | {"art/" + slug + "/index.html" for slug in COLLECTION_SLUGS}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
STUDIO_EXT = IMAGE_EXT | {
    ".pdf", ".txt", ".md", ".doc", ".docx", ".odt",
    ".tif", ".tiff", ".heic", ".heif", ".psd",
    ".mp3", ".m4a", ".wav", ".ogg", ".mp4", ".mov", ".webm",
}
MAX_CHANGED = 500
MAX_PREVIEW = 12000
_LOCK = threading.RLock()
_SECRET = secrets.token_bytes(32)


class PublishError(ValueError):
    pass


def run_git(*args: str, timeout: int = 25, check: bool = True) -> bytes:
    try:
        process = subprocess.run(
            ["git", "-C", str(ROOT), *args],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout,
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0", "GIT_OPTIONAL_LOCKS": "0"},
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise PublishError("Git is unavailable or timed out: " + str(exc)) from exc
    if process.returncode and check:
        detail = process.stderr.decode("utf-8", "replace").strip()
        raise PublishError(("Git " + " ".join(args[:2]) + ": " + detail)[:800])
    return process.stdout


def git_text(*args: str) -> str:
    return run_git(*args).decode("utf-8", "replace").strip()


def allowed_path(name: str) -> bool:
    if not isinstance(name, str) or name.startswith("/") or "\\" in name:
        return False
    parts = Path(name).parts
    if any(part in {".", ".."} or part.startswith(".") for part in parts):
        return False
    if name in PUBLIC_FILES:
        return True
    ext = Path(name).suffix.lower()
    if name.startswith("art/assets/works/") and len(parts) >= 5 and ext in IMAGE_EXT:
        return True
    if name.startswith("art/assets/studio/") and len(parts) == 4 and re.fullmatch(
        r"asset-[a-f0-9]{32}\.[a-z0-9]{1,12}", parts[-1]
    ) and ext in STUDIO_EXT:
        return True
    if name.startswith("art/assets/related/") and len(parts) == 4 and re.fullmatch(
        r"ref-[a-zA-Z0-9_-]{1,96}\.(?:jpg|jpeg|png|webp|gif|avif)", parts[-1], re.I
    ):
        return True
    return False


def ensure_context() -> None:
    top = git_text("rev-parse", "--show-toplevel")
    if Path(top).resolve() != ROOT.resolve():
        raise PublishError("ARTS Manager is not running in the expected Git working tree.")
    branch = git_text("branch", "--show-current")
    if branch != "master":
        raise PublishError("Switch to the master branch before publishing (currently " + (branch or "detached HEAD") + ").")
    remote = git_text("remote", "get-url", "origin")
    if remote.rstrip("/") not in {
        "https://github.com/" + SITE_REPO,
        "https://github.com/" + SITE_REPO + ".git",
        "git@github.com:" + SITE_REPO,
        "git@github.com:" + SITE_REPO + ".git",
        "ssh://git@github.com/" + SITE_REPO,
        "ssh://git@github.com/" + SITE_REPO + ".git",
    }:
        raise PublishError("Git origin does not match the expected ARTS repository. No action taken.")


def git_changes() -> list[dict]:
    # v1 porcelain zero terminated, including untracked items; rename has a
    # second source-name field, which is also checked for safety.
    raw = run_git("status", "--porcelain=v1", "-z", "--untracked-files=all")
    fields = raw.split(b"\0")
    changes = []
    i = 0
    while i < len(fields):
        field = fields[i]
        i += 1
        if not field:
            continue
        if len(field) < 4:
            raise PublishError("Unrecognized git status record")
        code = field[:2].decode("ascii", "replace")
        name = os.fsdecode(field[3:])
        old = ""
        if "R" in code or "C" in code:
            old = os.fsdecode(fields[i])
            i += 1
        if len(changes) >= MAX_CHANGED:
            raise PublishError("Too many changed files. Review in Git before proceeding.")
        if not name or name.startswith("-") or old and not allowed_path(old):
            allow = False
        else:
            allow = allowed_path(name)
        changes.append({
            "path": name, "change": code.strip() or "M",
            "oldPath": old, "included": allow,
            "staged": code[0] not in {" ", "?"},
            "reason": "" if allow else "Outside the ARTS public-gallery publishing allowlist",
        })
    return changes


def digest(changes: list[dict]) -> str:
    h = hashlib.sha256(git_text("rev-parse", "HEAD").encode("ascii"))
    for item in changes:
        h.update(json.dumps(item, sort_keys=True).encode("utf-8"))
        path = ROOT / item["path"]
        # Don't follow symlinks out of the repo, and disallow symlinks for
        # public files entirely.
        if item["included"] and path.is_symlink():
            raise PublishError("Refusing symbolic link: " + item["path"])
        if item["included"] and path.is_file():
            with path.open("rb") as inp:
                for block in iter(lambda: inp.read(1024 * 1024), b""):
                    h.update(block)
    return h.hexdigest()


def token(kind: str, value: str) -> str:
    return hmac.new(_SECRET, (kind + "\0" + value).encode(), hashlib.sha256).hexdigest()


def verify(kind: str, value: str, supplied: str) -> None:
    if not supplied or not hmac.compare_digest(token(kind, value), str(supplied)):
        raise PublishError("The review is outdated or incomplete. Refresh the review before continuing.")


def summary_json(path: str) -> dict:
    def records(blob: bytes | None, key: str) -> dict:
        if not blob:
            return {}
        try:
            contents = json.loads(blob)
            return {str(item["id"]): item for item in contents.get(key, [])
                    if isinstance(item, dict) and item.get("id")}
        except (ValueError, TypeError, KeyError, AttributeError):
            return {}

    key = "artworks" if path.endswith("/artworks.json") else "sets"
    before = run_git("show", "HEAD:" + path, check=False)
    local = ROOT / path
    after = local.read_bytes() if local.is_file() else None
    earlier, current = records(before, key), records(after, key)
    inserted = [current[k] for k in current.keys() - earlier.keys()]
    updated = [current[k] for k in current.keys() & earlier.keys()
               if current[k] != earlier[k]]
    removed = [earlier[k] for k in earlier.keys() - current.keys()]

    def compact(item: dict) -> dict:
        return {"id": item.get("id"), "title": item.get("title"),
                "collection": item.get("collection", ""),
                "status": item.get("status", "active"),
                "members": len(item.get("members", [])),
                "image": item.get("image", "")}

    return {
        "added": [compact(x) for x in sorted(inserted, key=lambda x: str(x["id"]))[:150]],
        "updated": [compact(x) for x in sorted(updated, key=lambda x: str(x["id"]))[:150]],
        "removed": [compact(x) for x in sorted(removed, key=lambda x: str(x["id"]))[:150]],
        "totals": {"added": len(inserted), "updated": len(updated), "removed": len(removed)},
    }


def detail(item: dict) -> dict:
    path = item["path"]
    target = ROOT / path
    result = dict(item)
    result["url"] = "/" + quote(path, safe="/")
    result["size"] = target.stat().st_size if target.is_file() else 0
    result["binary"] = Path(path).suffix.lower() not in {".json", ".html", ".txt", ".md"}
    result["public"] = True
    result["summary"] = {}
    result["diff"] = ""
    result["truncated"] = False
    if path in {"art/data/artworks.json", "art/data/related-public.json",
                "art/data/studio-related.json"}:
        result["summary"] = summary_json(path)
    if not result["binary"]:
        if item["change"] == "??":
            data = target.read_bytes() if target.is_file() else b""
            text = data.decode("utf-8", "replace")
        else:
            data = run_git("diff", "--no-ext-diff", "HEAD", "--", path)
            text = data.decode("utf-8", "replace")
        result["truncated"] = len(text) > MAX_PREVIEW
        result["diff"] = text[:MAX_PREVIEW]
    return result


def review() -> dict:
    with _LOCK:
        ensure_context()
        changes = git_changes()
        allowed = [item for item in changes if item["included"]]
        excluded = [item for item in changes if not item["included"]]
        staged_outside = [item["path"] for item in excluded if item["staged"]]
        return {
            "ok": True, "phase": "review", "branch": "master",
            "head": git_text("rev-parse", "--short", "HEAD"),
            "ready": bool(allowed) and not staged_outside,
            "files": [detail(item) for item in allowed],
            "excluded": excluded,
            "stagedOutside": staged_outside,
            "privateNote": ".art-private/ originals and OAuth secrets are ignored and NEVER staged.",
            "warning": "Each included file becomes accessible via GitHub and the public site after publishing. Review names, metadata, photographs and diffs carefully.",
            "token": token("commit", digest(changes)),
        }


def commit(review_token: str, message: str = "") -> dict:
    with _LOCK:
        ensure_context()
        changes = git_changes()
        included = [item["path"] for item in changes if item["included"]]
        if not included:
            raise PublishError("No pending public-gallery files to commit.")
        if any(item["staged"] and not item["included"] for item in changes):
            raise PublishError("Other changes are staged. Unstage them before using ARTS Commit.")
        verify("commit", digest(changes), review_token)
        message = str(message or "ARTS: save reviewed gallery changes").strip()
        if not message or "\n" in message or len(message) > 120 or message.startswith("-"):
            raise PublishError("Use a single-line commit message of at most 120 characters.")
        run_git("add", "-A", "--", *included, timeout=60)
        staged = run_git("diff", "--cached", "--name-only", "-z").split(b"\0")
        names = {os.fsdecode(x) for x in staged if x}
        if not names or names != set(included) or any(not allowed_path(x) for x in names):
            raise PublishError("Staging differs from the reviewed files. Stop and inspect Git status.")
        run_git("commit", "-m", message, timeout=90)
        return {"ok": True, "message": "Saved to local Git history. Nothing published yet.",
                "head": git_text("rev-parse", "--short", "HEAD"),
                "committedFiles": sorted(names)}


def origin_sha() -> str:
    remote = run_git("ls-remote", "--heads", "origin", "master", timeout=25).decode("ascii", "replace").strip()
    if not remote:
        raise PublishError("Cannot verify GitHub master. Check your connection and Git authentication.")
    first = remote.split()[0]
    if not re.fullmatch(r"[a-f0-9]{40}", first):
        raise PublishError("Unexpected GitHub response.")
    tracked = git_text("rev-parse", "refs/remotes/origin/master")
    if first != tracked:
        raise PublishError("GitHub master has moved. Fetch/pull updates and review again; never force-push.")
    return first


def outgoing(remote: str) -> dict:
    head = git_text("rev-parse", "HEAD")
    ancestor = run_git("merge-base", "--is-ancestor", remote, head, check=False)
    # merge-base --is-ancestor produces no stdout, check via rev-list instead.
    upstream_count = int(git_text("rev-list", "--count", head + ".." + remote))
    if upstream_count:
        raise PublishError("Local branch is behind GitHub; pull before publishing.")
    ahead = int(git_text("rev-list", "--count", remote + ".." + head))
    raw = run_git("diff", "--name-status", "-z", remote, head, "--")
    fields = raw.split(b"\0")
    changed = []
    i = 0
    while i < len(fields):
        code = fields[i]
        i += 1
        if not code:
            continue
        if i >= len(fields):
            raise PublishError("Could not parse outgoing file list")
        path = os.fsdecode(fields[i])
        i += 1
        if code.startswith((b"R", b"C")):
            if i >= len(fields):
                raise PublishError("Invalid rename metadata")
            other = os.fsdecode(fields[i])
            i += 1
            if not allowed_path(path) or not allowed_path(other):
                raise PublishError("Outgoing commit contains files outside ARTS gallery: " + path)
            changed.extend([path, other])
        else:
            changed.append(path)
    if any(not allowed_path(path) for path in changed):
        raise PublishError("An unpublished commit modifies files outside the gallery. Publish those separately using Git.")
    return {"ahead": ahead, "files": sorted(set(changed)), "head": head, "remote": remote}


def publish_review() -> dict:
    with _LOCK:
        ensure_context()
        pending = [item["path"] for item in git_changes() if item["included"]]
        if pending:
            raise PublishError("Local artwork changes are not committed. Review and commit them first.")
        remote = origin_sha()
        item = outgoing(remote)
        if not item["ahead"]:
            return {"ok": True, "phase": "publish", "ahead": 0,
                    "message": "GitHub is already up to date. Nothing to publish.",
                    "files": [], "token": ""}
        if not item["files"]:
            raise PublishError("There are outgoing commits but no public gallery file changes.")
        titles = git_text("log", "--format=%s", remote + "..HEAD").splitlines()
        item.update({
            "ok": True, "phase": "publish", "commits": titles,
            "token": token("publish", item["remote"] + "\0" + item["head"] +
                           "\0" + "\n".join(item["files"])),
            "message": "Publishing pushes these entire local Git commits and their files to GitHub.",
        })
        return item


def publish(review_token: str, confirmation: str) -> dict:
    with _LOCK:
        if confirmation != "PUBLISH":
            raise PublishError("Type PUBLISH to confirm public release.")
        info = publish_review()
        if not info.get("ahead"):
            raise PublishError("Nothing to publish.")
        verify("publish", info["remote"] + "\0" + info["head"] +
               "\0" + "\n".join(info["files"]), review_token)
        # No force, no auto-pull, no speculative success.
        result = run_git("push", "origin", "master", timeout=120)
        return {"ok": True, "message": "GitHub accepted the push. GitHub Pages deployment may take time.",
                "result": result.decode("utf-8", "replace").strip(),
                "head": info["head"], "files": info["files"]}
