# ARTS Manager: Studio Assets

Studio Assets is a **local-manager-only library** for supporting material that is
**not a separate exhibited artwork**. It extends the public **See related**
viewer without editing or migrating the existing related-work groups or references.

## Use

1. From the repository, start ./serve.sh and open http://localhost:8000/art/manage/.
2. Select an artwork if convenient, then open **Studio Assets** in the manager dock.
3. Drag/drop or select several files (maximum 25 MB each). Give them optional
   titles and notes.
4. Check one or more artworks in **Associate with artworks**; you may also leave
   assets unassigned and link them later.
5. Choose **Show when visitors click See related** or **Keep local**.
6. Click **Upload assets**. Edit associations, visibility, titles and notes
   later in the same library.

A linked public asset appears in **See related** in the appropriate published
Room; it does not become a Room card itself. If an artwork already participates
in a related-work group, that group is retained as-is and the visitor can
choose between the existing group and the new Studio materials group.

Unassigned, private or linked-only-to-hidden-artwork assets do not appear on
the public site.

## Storage and publication

- Original files: .art-private/studio/files/
- Local metadata index: .art-private/studio/assets.json
- Generated public files: art/assets/studio/
- Generated public relationship projection: art/data/studio-related.json
- Existing relationship master: .art-private/related/related-master.json (untouched)
- Existing published relationships: art/data/related-public.json (untouched)

The local store is excluded by .gitignore. **Back up
.art-private/studio/** separately if you want to preserve private source files
and the ability to continue editing associations after changing computers.

Uploaded files marked "related" are copied into the static public project by
the gallery build. They become publicly reachable only once the generated files
and projection are committed and pushed. "Related" is therefore a publishing
choice, **not an access control or a secret link**.

Safe document, image, audio and video extensions can be exported. Untrusted
active-content extensions (HTML, JavaScript, SVG, etc.) are kept local/private;
the library can still hold these files. Browsers may not preview every format
(e.g. HEIC, PSD), but visitors can open the original file for supported types.

For a manual publication from a local checkout:

    git status --short
    git add art/data/studio-related.json art/assets/studio
    git commit -m "Publish Studio material associations"
    git push

Check the staged diff first. Files removed from Studio Assets need their
corresponding public blobs removed from the commit too.

## Compatibility and backups

- No change to the existing related-group schema or existing member ordering.
- Studio relationships are linked directly to stable artwork IDs.
- A single supporting file may be associated with many artworks.
- Gallery rebuilds in a clone without the private Studio index retain the
  existing public Studio projection rather than erasing it.
- The local file HTTP endpoint denies direct URL access to .art-private.
- Run regression tests with:

      python -m unittest discover -s tests -p 'test_art_studio_assets.py' -v

The public data is independent; restoring the local metadata index and original
blobs is necessary for full local archive editability on a new machine.
