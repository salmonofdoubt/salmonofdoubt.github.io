# DiAndré Art Section

This folder contains the public art portfolio.

The visible gallery pages are generated from:

- art/data/artworks.json
- art/data/art-curation.json
- tools/build_art_gallery_static.py

## Local art curation

Start the one local art editing and preview server:

cd /Users/diandre/Downloads/VC/salmonofdoubt.github.io
./tools/curate_art.sh

Open:

http://localhost:8000/art/curate/

Then choose a target, click the artwork, press Save & rebuild, and preview:

http://localhost:8000/art/

When finished, press Ctrl+C, then commit and push.

8000 = one local art editing and preview server.
GitHub Pages = static published site.
Git commit/push = the only way changes go public.
