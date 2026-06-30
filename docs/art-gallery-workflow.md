# DiAndré Art Gallery Workflow

GitHub Pages has no hidden database and no server-side memory. The public /art/ gallery is static.

Source files:

- art/data/artworks.json
- art/data/art-curation.json
- tools/build_art_gallery_static.py
- tools/art_curator_server.py
- tools/curate_art.sh

Generated pages:

- art/index.html
- art/oil-paintings/index.html
- art/watercolours/index.html
- art/drawings/index.html
- art/experimental/index.html
- art/geospatial-imagery/index.html

Local curation workflow:

cd /Users/diandre/Downloads/VC/salmonofdoubt.github.io
./tools/curate_art.sh

Open http://localhost:8000/art/manage/

Choose target, click artwork, press Save & rebuild, then refresh http://localhost:8000/art/

When finished, press Ctrl+C.

Commit:

git status --short
git add art/data/art-curation.json art/index.html art/oil-paintings/index.html art/watercolours/index.html art/drawings/index.html art/experimental/index.html art/geospatial-imagery/index.html tools/art_curator_server.py tools/build_art_gallery_static.py tools/curate_art.sh art/curate/index.html art/curator/index.html docs/art-gallery-workflow.md art/README.md
git commit -m "Curate art gallery"
git push origin master
