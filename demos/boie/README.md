# Birds of Ireland Sound Atlas

A GitHub Pages demo for all species recorded on the Irish checklist, with representative public bird sounds where available.

## Architecture

```text
GitHub Action -> Python harvester -> data/birds.json -> static GitHub Pages app
```

## Sources

- Checklist: public "List of birds of Ireland" table.
- Audio metadata: xeno-canto API v2.
- Audio files are not copied into this repository. The site links to the source recording and displays recordist, country, licence, quality, and source URL.

## Local refresh

```bash
cd /Users/diandre/Downloads/VC/salmonofdoubt.github.io
python -m venv .venv-birds
source .venv-birds/bin/activate
pip install -r demos/boie/ops/requirements.txt
python demos/boie/ops/harvest_birds.py
python -m http.server 8000
```

Open:

```text
http://127.0.0.1:8000/demos/boie/
```
