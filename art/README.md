# DiAndré Art Site Workflow

This folder contains the public DiAndré art portfolio and its local management workflow.

Live page:

    https://salmonofdoubt.github.io/art/

Local manager:

    http://localhost:8000/art/manage/

## Start locally

From the repository root:

    cd /Users/diandre/Downloads/VC/salmonofdoubt.github.io
    ./serve.sh

Then open:

    http://localhost:8000/art/manage/

Use the existing local server. Do not start several separate servers.

## Main workflow

Use /art/manage/ to:

    upload one artwork
    upload several artworks at once
    assign collection/category
    set title, medium, subgroup and caption
    mark a work as collection feature
    mark a work as homepage hero
    hide or unhide works
    drag visible works into order
    save the visible order
    rebuild the public art pages

The manager is the normal editing surface. Avoid editing generated collection pages directly.

## Add new artworks

1. Open:

    http://localhost:8000/art/manage/

2. In Upload new work(s), choose one or several image files.

3. Select the collection:

    Oil Paintings
    Watercolours
    Drawings
    Experimental
    GeoSpatial Imagery

4. Fill in metadata:

    Title
    Medium
    Subgroup
    Caption

For batch uploads, the selected collection, medium, subgroup and caption apply to the whole batch. If the title field is blank, filenames are used as the basis for generated titles.

5. Click:

    Add work(s) & rebuild

6. Check the relevant local page:

    http://localhost:8000/art/oil-paintings/
    http://localhost:8000/art/watercolours/
    http://localhost:8000/art/drawings/
    http://localhost:8000/art/experimental/
    http://localhost:8000/art/geospatial-imagery/

## Order works

Use /art/manage/.

    1. Drag visible works into the desired order.
    2. Click Save visible order.
    3. Recheck the public collection page locally.

Do not reintroduce Move earlier or Move later controls. The current model is drag order plus save.

## Hide works

Use /art/manage/.

    Hide weak, duplicate or not-ready works.
    Hidden works remain in the data file.
    Hidden works should not appear publicly.
    Unhide a work if it should return.

## Source data

Main art data:

    art/data/artworks.json
    art/data/art-curation.json

Public image assets:

    art/assets/works/

Main art builder:

    tools/build_art_gallery_static.py

Manual rebuild:

    python3 tools/build_art_gallery_static.py

Generated public pages include:

    art/index.html
    art/oil-paintings/index.html
    art/watercolours/index.html
    art/drawings/index.html
    art/experimental/index.html
    art/geospatial-imagery/index.html

These generated pages are outputs. Do not use them as the main editing surface.

## Documentation archive

Public page:

    https://salmonofdoubt.github.io/art/documentation/

Local page:

    http://localhost:8000/art/documentation/

Documentation PDFs:

    art/assets/docs/

Documentation thumbnails:

    art/assets/docs/covers/

Documentation manifest:

    art/assets/docs/documentation.json

Documentation builders:

    tools/make_art_documentation_thumbnails.py
    tools/build_art_documentation.py

After changing documentation PDFs, run:

    python3 tools/make_art_documentation_thumbnails.py
    python3 tools/build_art_documentation.py

Keep public PDFs compressed. Do not publish large raw export PDFs when web-sized PDFs are sufficient.

## QR code

The art homepage includes a QR share element for:

    https://salmonofdoubt.github.io/art/

QR asset:

    art/assets/diandre-art-qr.png

The QR homepage placement is preserved by:

    tools/build_art_gallery_static.py

## Image size guidance

For public website images, prefer:

    1600-2400 px long edge
    JPEG or WebP
    usually under 1-2 MB

Avoid committing huge phone originals unless there is a clear reason.

## Publish art changes

After changing the art site:

    git status --short

    python3 -m py_compile \
      tools/build_art_gallery_static.py \
      tools/build_art_collection_pages.py \
      tools/build_art_documentation.py \
      tools/make_art_documentation_thumbnails.py

    python3 tools/build_art_gallery_static.py
    python3 tools/build_art_documentation.py

    git status --short

Then commit:

    git add -A art tools README.md
    git commit -m "Update art site"
    git push origin master

Check live after GitHub Pages updates:

    https://salmonofdoubt.github.io/art/
    https://salmonofdoubt.github.io/art/documentation/

## Do not do this

Do not manually edit generated collection pages as the normal workflow:

    art/oil-paintings/index.html
    art/watercolours/index.html
    art/drawings/index.html
    art/experimental/index.html
    art/geospatial-imagery/index.html

Do not bring back the temporary Instagram import-review workflow.

The current architecture is:

    /art/manage/          upload, curate, order, hide, rebuild
    /art/documentation/   process archive and PDFs
    /art/assets/works/    public image assets
    /art/assets/docs/     public document assets
