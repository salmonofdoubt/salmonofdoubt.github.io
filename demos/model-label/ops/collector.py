"""Public disclosure monitor. Python standard library only; no chatbot calls."""
from __future__ import annotations

import copy
import hashlib
import json
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from signals import discover, operator_status, google_workspace_status

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get("MODEL_LABEL_DATA_DIR", ROOT / "web/demos/model-label/data"))
CATALOG = DATA / "catalogue.json"
STATE = DATA / "monitor.json"
USER_AGENT = "ModelLabelDemo/0.1 (public-disclosure monitoring; no model inference)"
MAX_BYTES = 2_000_000


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def read_json(path, fallback=None):
    if not path.exists():
        return copy.deepcopy(fallback)
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, path)


class PageText(HTMLParser):
    """Ignore scripts, styling, menus and footer noise. Preserve text order."""
    OMIT = {"script", "style", "nav", "footer", "noscript", "svg"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.title_parts, self.stack = [], [], []
        self.in_title = False
        self.in_h1 = False
        self.heading_parts = []
        self.language = None

    def handle_starttag(self, tag, attrs):
        if tag == "html":
            self.language = dict(attrs).get("lang")
        if tag == "title":
            self.in_title = True
        if tag == "h1":
            self.in_h1 = True
        if tag in self.OMIT:
            self.stack.append(tag)
        if tag in {"p", "div", "h1", "h2", "h3", "li", "br", "tr"} and not self.stack:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "h1":
            self.in_h1 = False
        if tag in self.stack:
            # Void and malformed elements must not trap the rest of a page.
            self.stack = self.stack[:self.stack.index(tag)]
        if tag in {"p", "div", "h1", "h2", "h3", "li", "tr"} and not self.stack:
            self.parts.append("\n")

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)
        if self.in_h1 and not self.stack:
            self.heading_parts.append(data)
        if not self.stack and not self.in_title:
            self.parts.append(data)

    def result(self):
        lines = [re.sub(r"\s+", " ", line).strip() for line in "".join(self.parts).splitlines()]
        text = "\n".join(line for line in lines if line)
        title = re.sub(r"\s+", " ", " ".join(self.title_parts)).strip()[:240]
        return title, text


class HTTPSOnly(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlsplit(newurl).scheme != "https":
            raise ValueError("Non-HTTPS redirect rejected")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def request(url, timeout=10, limit=MAX_BYTES):
    if urllib.parse.urlsplit(url).scheme != "https":
        raise ValueError("Only HTTPS public sources are supported")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "en-IE,en;q=0.9", "Accept": "text/html,text/plain;q=0.8"})
    with urllib.request.build_opener(HTTPSOnly()).open(req, timeout=timeout) as response:
        raw = response.read(limit + 1)
        if len(raw) > limit:
            raise ValueError("Document exceeds collection size limit")
        return raw, dict(response.headers), response.geturl(), response.status


def robots_permission(url):
    base = urllib.parse.urlsplit(url)
    robots_url = urllib.parse.urlunsplit((base.scheme, base.netloc, "/robots.txt", "", ""))
    try:
        raw, _, _, _ = request(robots_url, timeout=6, limit=250_000)
        parser = urllib.robotparser.RobotFileParser()
        parser.parse(raw.decode("utf-8", errors="replace").splitlines())
        return parser.can_fetch(USER_AGENT, url), "checked"
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            return False, "access denied"
        if exc.code == 404:
            return True, "no robots file"
        return False, "robots unavailable"
    except Exception:
        return False, "robots unavailable"


def collect(source, previous=None):
    """Keep last successful evidence on failure. No automatic label rewriting."""
    result = copy.deepcopy(previous or {})
    result.update({"source_id": source["id"], "url": source["url"], "last_attempt": utc_now()})
    try:
        permitted, robots_status = (True, "Public machine-readable status API") if source.get("kind")=="operator_status" else robots_permission(source["url"])
        result["robots"] = robots_status
        if not permitted:
            result.update(status="blocked", error="Collection stopped by robots policy or unavailable robots check.")
            return result, None
        raw, headers, final_url, status = request(source["url"])
        content_type = next((v for k, v in headers.items() if k.lower() == "content-type"), "")
        if source.get('kind') == 'operator_status':
            payload=json.loads(raw.decode('utf-8'))
            signal=google_workspace_status(payload,source['component_match']) if source.get('status_format')=='google_workspace' else operator_status(payload,source['component_match'])
            result.update(status='ok',last_success=utc_now(),error=None,operator=signal)
            return result,None
        if source.get('kind') == 'registry':
            entries=discover(raw.decode('utf-8',errors='replace'),source['url'],source['publisher'])
            if not entries: raise ValueError('No recognised catalogue entries; parser or catalogue may have changed')
            result.update(discovered=entries)
        if not any(kind in content_type.lower() for kind in ("text/html", "text/plain", "application/xhtml+xml")):
            raise ValueError("Unsupported content type; inspect the original source")
        text = raw.decode("utf-8", errors="replace")
        parser = PageText()
        parser.feed(text)
        title, normalised = parser.result()
        heading = re.sub(r"\s+", " ", " ".join(parser.heading_parts)).strip()
        missing = r"^(?:this page (?:does not|doesn't|doesn’t) exist|page not found|404\b|not found\b)"
        if re.search(missing, heading, re.I) or re.search(missing, title, re.I):
            raise ValueError("Missing-page response (soft 404); not usable disclosure evidence")
        if len(normalised) < 100 or re.search(r"^(just a moment|access denied|attention required)", title, re.I):
            raise ValueError("No usable page text; a JavaScript page or access challenge may require manual review")
        digest = hashlib.sha256(normalised.encode("utf-8")).hexdigest()
        old_digest = result.get("sha256")
        changed = bool(old_digest and old_digest != digest)
        event = None
        if changed or not old_digest:
            event = {"at": utc_now(), "kind": "document_changed" if changed else "baseline_captured", "source_id": source["id"], "before_sha256": old_digest, "after_sha256": digest, "title": title}
        result.update(status="ok", error=None, title=title or source["title"], final_url=final_url, http_status=status,
                      sha256=digest, last_success=utc_now(), language=parser.language, characters=len(normalised),
                      excerpt=normalised[:220], page_last_modified=next((v for k, v in headers.items() if k.lower() == "last-modified"), None))
        if changed:
            result["changed_at"] = utc_now()
            result["review_needed"] = True
        else:
            result.setdefault("review_needed", False)
        return result, event
    except urllib.error.HTTPError as exc:
        result.update(status="blocked" if exc.code in {401, 403, 429} else "error", http_status=exc.code,
                      error=f"HTTP {exc.code}; last successful capture retained if available.")
    except Exception as exc:
        result.update(status="error", error=str(exc)[:240])
    return result, None


class Monitor:
    def __init__(self, interval_hours=24):
        self.lock = threading.RLock()
        self.interval_hours = interval_hours
        self.state = read_json(STATE, {"schema_version": 1, "sources": {}, "events": [], "last_refresh": None})
        self.job = {"running": False, "completed": 0, "total": 0, "current": None, "last_error": None}
        self.catalogue = read_json(CATALOG)
        self.stop = threading.Event()

    def snapshot(self):
        with self.lock:
            return {"catalogue": copy.deepcopy(self.catalogue), "monitor": copy.deepcopy(self.state),
                    "collector": {"available": True, "interval_hours": self.interval_hours, "job": copy.deepcopy(self.job)}}

    def start_refresh(self, service_id=None, status_only=False):
        with self.lock:
            if self.job["running"]:
                return False
            source_ids = None
            if service_id:
                service = next((s for s in self.catalogue["services"] if s["id"] == service_id), None)
                if not service:
                    raise ValueError("Unknown service")
                source_ids = set(service["source_ids"])
            targets = [s for s in self.catalogue["sources"] if (source_ids is None or s["id"] in source_ids) and (not status_only or s.get("kind")=="operator_status")]
            self.job = {"running": True, "completed": 0, "total": len(targets), "current": None, "last_error": None}
            threading.Thread(target=self._refresh, args=(targets,), daemon=True).start()
            return True

    def _refresh(self, targets):
        full_round = {s["id"] for s in targets} == {s["id"] for s in self.catalogue["sources"]}
        try:
            for source in targets:
                with self.lock:
                    self.job["current"] = source["title"]
                    previous = copy.deepcopy(self.state["sources"].get(source["id"]))
                item, event = collect(source, previous)
                with self.lock:
                    self.state["sources"][source["id"]] = item
                    if source.get('kind')=='registry' and item.get('status')=='ok':
                        registry=self.state.setdefault('discovered_models',{})
                        for entry in item.get('discovered',[]):
                            key=entry['provider']+':'+entry['id']
                            old=registry.get(key,{})
                            registry[key]={**entry,'first_seen':old.get('first_seen',utc_now()),'last_seen':utc_now(),'registry_source':source['id']}
                            if not old:self.state['events'].insert(0,{'at':utc_now(),'kind':'model_discovered','source_id':source['id'],'summary':entry['id']})
                    if source.get('kind')=='operator_status':
                        history=self.state.setdefault('availability_history',[])
                        history.insert(0,{'at':utc_now(),'service_id':source['service_id'],'status':item.get('operator',{}).get('status','unknown') if item.get('status')=='ok' else 'unknown','check_status':item.get('status'),'method':'Operator feed'})
                        self.state['availability_history']=history[:300]
                    if event:
                        self.state["events"].insert(0, event)
                        self.state["events"] = self.state["events"][:300]
                    self.job["completed"] += 1
                    write_json(STATE, self.state)
                if self.stop.wait(0.75):
                    break
            with self.lock:
                if full_round:
                    self.state["last_refresh"] = utc_now()
                    failed = [s["id"] for s in targets if self.state["sources"].get(s["id"],{}).get("status") != "ok"]
                    self.state["refresh_summary"] = {"at":utc_now(),"total":len(targets),"successful":len(targets)-len(failed),"failed":failed,"complete":self.job["completed"]==len(targets)}
                write_json(STATE, self.state)
        except Exception as exc:
            with self.lock:
                self.job["last_error"] = str(exc)[:240]
        finally:
            with self.lock:
                self.job.update(running=False, current=None)

    def save_field(self, payload):
        with self.lock:
            if self.job["running"]:
                raise ValueError("Wait for the source refresh to finish before recording a review")
            service = next((s for s in self.catalogue["services"] if s["id"] == payload.get("service_id")), None)
            if not service:
                raise ValueError("Unknown service")
            field = next((f for f in service["fields"] if f["id"] == payload.get("field_id")), None)
            if not field:
                raise ValueError("Unknown label field")
            status, summary = payload.get("status"), str(payload.get("summary", "")).strip()
            if status not in {"partial", "provider_claim", "unknown"} or not 1 <= len(summary) <= 1200:
                raise ValueError("Choose a valid status and a summary of 1–1200 characters")
            refs = payload.get("source_ids", [])
            if not isinstance(refs, list) or any(s not in service["source_ids"] for s in refs):
                raise ValueError("Use only this service's registered source references")
            if status != "unknown" and not refs:
                raise ValueError("A documented entry requires at least one source")
            reviewed_at = utc_now()
            field.update(status=status, summary=summary, source_ids=refs, reviewed_at=reviewed_at,
                         reviewer="Local user", reviewed_hashes={s: self.state["sources"].get(s, {}).get("sha256") for s in refs})
            service["label_reviewed_at"] = reviewed_at
            write_json(CATALOG, self.catalogue)
            self.state["events"].insert(0, {"at": reviewed_at, "kind": "label_reviewed", "service_id": service["id"], "field_id": field["id"], "summary": summary})
            write_json(STATE, self.state)

    def scheduler(self):
        if self.interval_hours <= 0:
            return
        while not self.stop.wait(30):
            last = self.state.get("last_refresh")
            try:
                age = (datetime.now(timezone.utc) - datetime.fromisoformat(last.replace("Z", "+00:00"))).total_seconds() if last else float("inf")
            except (ValueError, TypeError):
                age = float("inf")
            if age >= self.interval_hours * 3600:
                self.start_refresh()
            elif not self.job['running']:
                status_sources=[s for s in self.catalogue['sources'] if s.get('kind')=='operator_status']
                def due(source):
                    at=self.state['sources'].get(source['id'],{}).get('last_attempt')
                    try:return (datetime.now(timezone.utc)-datetime.fromisoformat(at.replace('Z','+00:00'))).total_seconds()>=900
                    except (ValueError,TypeError,AttributeError):return True
                if any(due(s) for s in status_sources):self.start_refresh(status_only=True)
