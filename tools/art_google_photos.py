"""Google Photos Picker integration for the localhost ARTS Manager.

Only user-picked media can be accessed. Credentials, OAuth tokens and picking
state live outside the public web root in ignored .art-private/.
No third-party Python packages required.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import art_studio_assets as studio

PRIVATE = Path(__file__).resolve().parents[1] / ".art-private" / "google-photos"
CONFIG = PRIVATE / "client.json"
TOKEN = PRIVATE / "token.json"
FLOW = PRIVATE / "oauth-flow.json"
PICK = PRIVATE / "picker-session.json"

SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly"
PICKER = "https://photospicker.googleapis.com/v1"
TOKEN_URL = "https://oauth2.googleapis.com/token"
OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"


def local_origin() -> str:
    return "http://localhost:" + str(int(os.environ.get("ART_CURATOR_PORT", "8000")))


def callback_uri() -> str:
    return local_origin() + "/api/google-photos/callback"


def read_secret(path: Path) -> dict:
    if not path.exists():
        return {}
    value = json.loads(path.read_text(encoding="utf-8"))
    return value if isinstance(value, dict) else {}


def store_secret(path: Path, value: dict) -> None:
    PRIVATE.mkdir(parents=True, exist_ok=True)
    PRIVATE.chmod(0o700)
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("w", encoding="utf-8") as stream:
        os.chmod(temporary, 0o600)
        json.dump(value, stream)
    temporary.replace(path)


def public_status() -> dict:
    cfg = read_secret(CONFIG)
    tok = read_secret(TOKEN)
    session = read_secret(PICK)
    return {
        "configured": bool(cfg.get("clientId") and cfg.get("clientSecret")),
        "connected": bool(tok.get("refresh_token") or
                          (tok.get("access_token") and tok.get("expires_at", 0) > time.time())),
        "picking": bool(session.get("id")),
        "redirectUri": callback_uri(),
        "importTargets": ["room", "studio"],
        "apiVersion": 3,
    }


def configure(payload: dict) -> dict:
    client_id = str(payload.get("clientId") or "").strip()
    client_secret = str(payload.get("clientSecret") or "").strip()
    if not client_id.endswith(".apps.googleusercontent.com") or len(client_id) > 300:
        raise ValueError("Enter the OAuth Client ID from Google Cloud (Web application)")
    if not client_secret or len(client_secret) > 400:
        raise ValueError("Enter the matching OAuth Client Secret")
    prev = read_secret(CONFIG)
    if prev.get("clientId") != client_id or prev.get("clientSecret") != client_secret:
        disconnect(revoke=False)
    store_secret(CONFIG, {"clientId": client_id, "clientSecret": client_secret})
    return public_status()


def oauth_start() -> str:
    cfg = read_secret(CONFIG)
    if not cfg.get("clientId") or not cfg.get("clientSecret"):
        raise ValueError("Configure your Google Photos OAuth client first")
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode("ascii")).digest()
    ).rstrip(b"=").decode("ascii")
    store_secret(FLOW, {"state": state, "verifier": verifier, "issued": time.time()})
    query = urllib.parse.urlencode({
        "client_id": cfg["clientId"],
        "redirect_uri": callback_uri(),
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    return OAUTH_URL + "?" + query


def token_request(values: dict) -> dict:
    body = urllib.parse.urlencode(values).encode("utf-8")
    request = urllib.request.Request(
        TOKEN_URL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST")
    return request_json(request)


def oauth_complete(code: str, state: str) -> None:
    flow = read_secret(FLOW)
    # One-time nonce, time limited. Delete it even on failure.
    FLOW.unlink(missing_ok=True)
    if (not flow.get("state") or not hmac.compare_digest(str(state), str(flow["state"]))
            or time.time() - float(flow.get("issued") or 0) > 600):
        raise ValueError("OAuth state mismatch or expired. Connect again.")
    if not code:
        raise ValueError("Google did not return an authorization code")
    cfg = read_secret(CONFIG)
    result = token_request({
        "code": code,
        "client_id": cfg["clientId"],
        "client_secret": cfg["clientSecret"],
        "redirect_uri": callback_uri(),
        "grant_type": "authorization_code",
        "code_verifier": flow["verifier"],
    })
    if not result.get("access_token"):
        raise ValueError("Google did not provide an access token")
    result["expires_at"] = time.time() + int(result.get("expires_in") or 3600) - 60
    store_secret(TOKEN, result)


def access_token() -> str:
    token = read_secret(TOKEN)
    if token.get("access_token") and float(token.get("expires_at") or 0) > time.time():
        return str(token["access_token"])
    if not token.get("refresh_token"):
        raise ValueError("Google Photos is not connected. Authorize it in Studio Assets.")
    cfg = read_secret(CONFIG)
    refreshed = token_request({
        "client_id": cfg["clientId"],
        "client_secret": cfg["clientSecret"],
        "refresh_token": token["refresh_token"],
        "grant_type": "refresh_token",
    })
    if not refreshed.get("access_token"):
        raise ValueError("Google token refresh failed. Connect Google Photos again.")
    token.update(refreshed)
    token["expires_at"] = time.time() + int(refreshed.get("expires_in") or 3600) - 60
    store_secret(TOKEN, token)
    return token["access_token"]


def disconnect(revoke: bool = False) -> None:
    token = read_secret(TOKEN)
    if revoke and token.get("access_token"):
        try:
            data = urllib.parse.urlencode({"token": token["access_token"]}).encode()
            urllib.request.urlopen(
                urllib.request.Request("https://oauth2.googleapis.com/revoke",
                                       data=data, method="POST"), timeout=10).close()
        except (urllib.error.URLError, OSError):
            pass
    TOKEN.unlink(missing_ok=True)
    FLOW.unlink(missing_ok=True)
    # An old picker session will no longer be usable after disconnect.
    PICK.unlink(missing_ok=True)


def request_json(request: urllib.request.Request) -> dict:
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            result = json.loads(response.read(2 * 1024 * 1024).decode("utf-8"))
        if not isinstance(result, dict):
            raise ValueError("Unexpected Google API response")
        return result
    except urllib.error.HTTPError as err:
        try:
            message = json.loads(err.read(8192).decode("utf-8")).get("error", {})
            detail = message.get("message", "") if isinstance(message, dict) else str(message)
        except (ValueError, OSError):
            detail = ""
        raise ValueError("Google API error " + str(err.code) + (": " + detail[:250] if detail else "")) from err
    except urllib.error.URLError as err:
        raise ValueError("Cannot reach Google Photos: " + str(err.reason)) from err


def picker_call(path: str, method: str = "GET", payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Authorization": "Bearer " + access_token()}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(PICKER + path, data=data, headers=headers, method=method)
    return request_json(req)


def stop_session() -> None:
    current = read_secret(PICK)
    PICK.unlink(missing_ok=True)
    if current.get("id"):
        try:
            picker_call("/sessions/" + urllib.parse.quote(str(current["id"]), safe=""),
                        method="DELETE")
        except (ValueError, urllib.error.URLError):
            pass


def start_session() -> dict:
    stop_session()
    response = picker_call("/sessions", "POST", {"pickingConfig": {"maxItemCount": "50"}})
    if not response.get("id") or not response.get("pickerUri"):
        raise ValueError("Google Photos did not return a picker session")
    store_secret(PICK, {"id": response["id"], "created": time.time()})
    return {
        "pickerUri": response["pickerUri"],  # only Google's returned URI
        "pollAfter": poll_seconds(response),
    }


def poll_seconds(response: dict) -> float:
    raw = str((response.get("pollingConfig") or {}).get("pollInterval") or "4s")
    try:
        return min(30.0, max(2.0, float(raw.rstrip("s"))))
    except ValueError:
        return 4.0


def require_session() -> str:
    record = read_secret(PICK)
    if not record.get("id") or time.time() - float(record.get("created") or 0) > 3600:
        raise ValueError("No active Google Photos selection. Start a new picker.")
    return str(record["id"])


def poll_session() -> dict:
    session_id = require_session()
    value = picker_call("/sessions/" + urllib.parse.quote(session_id, safe=""))
    if not value.get("mediaItemsSet"):
        return {"ready": False, "pollAfter": poll_seconds(value), "items": []}
    items = selected_items(session_id)
    return {"ready": True, "items": [{
        "id": obj.get("id"),
        "filename": (obj.get("mediaFile") or {}).get("filename") or "photo",
        "mimeType": (obj.get("mediaFile") or {}).get("mimeType") or "",
        "createTime": obj.get("createTime") or "",
    } for obj in items]}


def selected_items(session_id: str) -> list[dict]:
    found = []
    page = ""
    for _ in range(25):
        query = {"sessionId": session_id, "pageSize": "100"}
        if page:
            query["pageToken"] = page
        result = picker_call("/mediaItems?" + urllib.parse.urlencode(query))
        found.extend(result.get("mediaItems") or [])
        page = str(result.get("nextPageToken") or "")
        if not page:
            return found
    raise ValueError("Too many Google Photos results; select a smaller batch")


def google_media_url(base_url: str, is_video: bool) -> str:
    url = urllib.parse.urlsplit(base_url)
    host = (url.hostname or "").lower()
    if url.scheme != "https" or url.username or url.password or url.port not in (None, 443):
        raise ValueError("Invalid Google Photos media URL")
    if host != "googleusercontent.com" and not host.endswith(".googleusercontent.com"):
        raise ValueError("Refusing non-Google media download URL")
    if not url.path or url.query or url.fragment:
        raise ValueError("Unexpected Google media URL format")
    return base_url + ("=dv" if is_video else "=d")


class SafeGoogleMediaRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # The bearer token is never forwarded to an untrusted host.
        media = urllib.parse.urlsplit(newurl)
        host = (media.hostname or "").lower()
        if (media.scheme != "https" or
            (host != "googleusercontent.com" and
             not host.endswith(".googleusercontent.com"))):
            raise ValueError("Google media download redirected to an untrusted host")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download_media(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + access_token()})
    opener = urllib.request.build_opener(SafeGoogleMediaRedirect())
    try:
        with opener.open(req, timeout=50) as resp:
            content = resp.read(studio.MAX_BYTES + 1)
    except urllib.error.HTTPError as err:
        raise ValueError("Google photo download failed (HTTP " + str(err.code) + ")") from err
    if not content or len(content) > studio.MAX_BYTES:
        raise ValueError("File is empty or exceeds the 25 MB Studio Assets limit")
    return content


def import_picked(payload: dict) -> dict:
    session_id = require_session()
    state = picker_call("/sessions/" + urllib.parse.quote(session_id, safe=""))
    if not state.get("mediaItemsSet"):
        raise ValueError("Finish selecting photos in Google Photos first")
    items = {str(obj.get("id")): obj for obj in selected_items(session_id)}
    wanted = payload.get("ids")
    if not isinstance(wanted, list) or not wanted or len(wanted) > 50:
        raise ValueError("Select between 1 and 50 photos to import")
    links = studio.normalise_links(payload.get("artworkIds") or [])
    visibility = str(payload.get("visibility") or "related")
    if visibility not in {"private", "related"}:
        raise ValueError("Invalid visibility")
    success = []
    failures = []
    seen = set()
    for media_id in wanted:
        ident = str(media_id)
        if ident in seen:
            continue
        seen.add(ident)
        item = items.get(ident)
        if item is None:
            failures.append({"id": ident, "error": "Not in the selected Google Photos session"})
            continue
        media_file = item.get("mediaFile") or {}
        mime = str(media_file.get("mimeType") or "").lower()
        filename = Path(str(media_file.get("filename") or "").replace("\\", "/")).name
        if not filename:
            filename = "google-photo-" + secrets.token_hex(5) + (".mp4" if mime.startswith("video/") else ".jpg")
        if not (mime.startswith("image/") or mime.startswith("video/")):
            failures.append({"id": ident, "error": "Not a photo or video"})
            continue
        try:
            url = google_media_url(media_file.get("baseUrl") or "", mime.startswith("video/"))
            data = download_media(url)
            result = studio.upload_asset({
                "filename": filename, "title": filename,
                "note": "Imported from Google Photos" +
                    ((" · Captured " + str(item["createTime"])[:10]) if item.get("createTime") else ""),
                "artworkIds": links, "visibility": visibility,
                "fileDataUrl": "data:" + mime + ";base64," +
                               base64.b64encode(data).decode("ascii"),
            })
            success.append(studio.client_asset(result))
        except (ValueError, urllib.error.URLError, OSError) as err:
            failures.append({"id": ident, "filename": filename, "error": str(err)[:250]})
    if not failures:
        stop_session()
    return {"imported": success, "failures": failures,
            "message": str(len(success)) + " imported, " + str(len(failures)) + " failed" }


# MAIN_GALLERY_PHOTOS_IMPORT_V1
# Import selected Photos as new published artwork records rather than Studio Assets.
# Keep this code separate from import_picked(), which is intentionally archival.
GALLERY_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def import_picked_artworks(payload: dict, create_artwork) -> dict:
    """Download selected Google Photos and invoke the existing artwork creator.

    The caller persists the returned artwork records to artworks.json and
    performs a single gallery rebuild. No existing artworks or relationship
    records are changed by this function.
    """
    session_id = require_session()
    session = picker_call("/sessions/" + urllib.parse.quote(session_id, safe=""))
    if not session.get("mediaItemsSet"):
        raise ValueError("Finish selecting your photos in Google Photos first")

    wanted = payload.get("ids")
    if (not isinstance(wanted, list) or not wanted or len(wanted) > 50 or
            any(not isinstance(identifier, str) or not identifier for identifier in wanted)):
        raise ValueError("Select between 1 and 50 Google Photos images")

    chosen = {str(obj.get("id")): obj for obj in selected_items(session_id)}
    unique = list(dict.fromkeys(wanted))
    # A "feature" selector must never silently choose a winner in a batch.
    if len(unique) != 1 and (payload.get("makeCollectionFeature") or payload.get("makeHomepageHero")):
        raise ValueError("Feature selection is available for a single image only")

    collection = str(payload.get("collection") or "").strip()
    if not collection:
        raise ValueError("Choose the artwork's Room")
    title_for_one = str(payload.get("title") or "").strip()
    imported, failures = [], []

    for media_id in unique:
        item = chosen.get(media_id)
        if item is None:
            failures.append({"id": media_id, "error": "Not in this Google Photos selection"})
            continue
        media_file = item.get("mediaFile") or {}
        mime = str(media_file.get("mimeType") or "").lower()
        filename = Path(str(media_file.get("filename") or "").replace("\\", "/")).name
        if mime not in GALLERY_IMAGE_MIMES:
            failures.append({"id": media_id, "filename": filename,
                             "error": "This Room upload accepts JPEG, PNG, WebP or GIF images only. Videos and HEIC can go into Studio Assets."})
            continue
        if not filename:
            filename = "google-photo-" + secrets.token_hex(5)
        title = (title_for_one if len(unique) == 1 and title_for_one else
                 re.sub(r"[-_]+", " ", Path(filename).stem).strip() or "Google Photos artwork")
        try:
            media_url = google_media_url(str(media_file.get("baseUrl") or ""), False)
            data = download_media(media_url)
            record = create_artwork({
                "imageDataUrl": "data:" + mime + ";base64," +
                                base64.b64encode(data).decode("ascii"),
                "title": title, "collection": collection,
                "medium": str(payload.get("medium") or "").strip() or collection,
                "subgroup": str(payload.get("subgroup") or "").strip() or "Other",
                "alt": title,
                "text": str(payload.get("text") or "").strip(),
                "reading": str(payload.get("text") or "").strip(),
            })
            record["source"] = "Google Photos import"
            imported.append(record)
        except (ValueError, urllib.error.URLError, OSError) as exc:
            failures.append({"id": media_id, "filename": filename, "error": str(exc)[:250]})

    # If one import failed, allow the user to retry through the current picker.
    if not failures:
        stop_session()
    return {
        "imported": imported,
        "failures": failures,
        "message": str(len(imported)) + " artwork(s) imported, " +
                   str(len(failures)) + " failed",
    }
