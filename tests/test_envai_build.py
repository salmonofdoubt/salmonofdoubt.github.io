"""EnvAI release gate: first-paint build stamp and cache-busted assets stay in sync.

Every EnvAI application revision must advance a visible, dated build number,
not merely an internal PWA cache identifier. The pull-request gate compares
with the target branch, preventing silent reused versions.
"""
import os
import pathlib
import re
import subprocess

ROOT=pathlib.Path(__file__).resolve().parents[1]
HTML=ROOT/"demos/envai/index.html"
GUIDE=ROOT/"demos/envai/how-it-works.html"
SW=ROOT/"demos/envai/service-worker.js"
ASSETS=("styles.css","mobile.css","app.js","cluster-model.js")
PATTERN=re.compile(r"^\d{4}\.\d{2}\.\d{2}\.\d{2,}$")


def stamp(html):
    match=re.search(r'id="buildStamp"[^>]*data-build="([^"]+)"',html)
    assert match, "Visible first-paint #buildStamp with data-build is required"
    build=match.group(1)
    assert PATTERN.fullmatch(build), f"Invalid build version: {build}"
    assert f"Build {build}</span>" in html, "Visible text must show the actual build"
    assert f'<meta name="application-build" content="{build}">' in html, (
        "Meta build and visible build stamp must agree")
    return build


def validate():
    html=HTML.read_text(encoding="utf8")
    guide=GUIDE.read_text(encoding="utf8")
    sw=SW.read_text(encoding="utf8")
    build=stamp(html)
    for asset in ASSETS:
        expected=f'./{asset}?v=b{build}'
        assert expected in html, f"Missing cache bust for {asset} in index.html"
        assert f"'{expected}'" in sw, f"Missing cache bust for {asset} in service worker"
    for asset in ("cluster-model.js","how-it-works.js"):
        assert f'./{asset}?v=b{build}' in guide, f"Guide not versioned for {asset}"
        assert f"'./{asset}?v=b{build}'" in sw, f"SW not versioned for {asset}"
    cache=re.search(r"const CACHE='sod-envai-v(\d+)-b([^']+)'",sw)
    assert cache, "Expected versioned PWA cache key"
    assert cache.group(2)==build, "Build stamp differs from PWA cache build"
    base=os.getenv("ENVAI_BASE_SHA","").strip()
    if base:
        # Shallow CI checkouts need only one extra base commit, not the entire
        # repository history. Fetch it explicitly when it is absent.
        present=subprocess.run(["git","cat-file","-e",f"{base}^{{commit}}"],
                               capture_output=True,check=False)
        if present.returncode:
            subprocess.run(["git","fetch","--no-tags","--depth=1","origin",base],
                           capture_output=True,text=True,check=True)
        old_html=subprocess.run(["git","show",f"{base}:demos/envai/index.html"],
                 capture_output=True,text=True,check=True).stdout
        old_sw=subprocess.run(["git","show",f"{base}:demos/envai/service-worker.js"],
                 capture_output=True,text=True,check=True).stdout
        diff=subprocess.run(["git","diff","--name-only",base,"HEAD","--","demos/envai",
                             "scripts/envai_auto_update.py"],
                 capture_output=True,text=True,check=True).stdout.splitlines()
        changed=[p for p in diff if p!="demos/envai/data/live-updates.json"]
        if changed:
            previous=re.search(r'id="buildStamp"[^>]*data-build="([^"]+)"',old_html)
            if previous:
                old_version=previous.group(1)
                assert tuple(map(int,build.split(".")))>tuple(map(int,old_version.split("."))),(
                    f"Application changed but build stayed at {old_version}; increment it")
            old_cache=re.search(r"const CACHE='sod-envai-v(\d+)",old_sw)
            if old_cache:
                assert int(cache.group(1))>int(old_cache.group(1)),(
                    "Application changed but PWA cache number was not bumped")
    print(f"PASS: EnvAI build {build}; matching visible HTML, assets and PWA cache")


if __name__=="__main__":
    validate()
