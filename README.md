# salmonofdoubt.github.io

Public GitHub Pages site for André Baumann / DiAndré projects, art archives, research demos and web experiments.

Live site:

    https://salmonofdoubt.github.io/

Main areas:

    /art/                     DiAndré art portfolio
    /art/manage/              Local art manager for updating the art portfolio
    /art/documentation/       Art books, journals, process PDFs and provenance archive
    /demos/                   Public demos and experiments

## Local server

From the repository root:

    ./serve.sh

Then open:

    http://localhost:8000/

Do not test pages by double-clicking HTML files. Several pages rely on local fetches, generated assets and repo-relative paths.

## Updating the art site

Use the local manager:

    http://localhost:8000/art/manage/

Detailed instructions are in:

    art/README.md

Short workflow:

    1. Start ./serve.sh
    2. Open /art/manage/
    3. Upload, hide, edit, order or feature works
    4. Rebuild from the manager or run the builder
    5. Check locally
    6. Commit and push

Manual rebuild commands:

    python3 tools/build_art_gallery_static.py
    python3 tools/build_art_documentation.py

Publish:

    git status --short
    git add -A art tools
    git commit -m "Describe the change"
    git push origin master

GitHub Pages publishes from master.

## Important rule

Generated collection pages should not be manually edited as the normal workflow. For the art section, update the source data through /art/manage/ and rebuild.
