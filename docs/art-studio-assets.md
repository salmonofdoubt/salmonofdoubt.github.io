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


## Google Photos direct import

Studio Assets now contains **Import directly from Google Photos**, using Google's
official **Google Photos Picker API**. It does not browse your Photos library
without your explicit selection.

### One-time configuration

1. Go to https://console.cloud.google.com/ and choose/create a project.
2. In APIs & Services > Library, enable **Google Photos Picker API**
   (not the unrelated "Google Picker API").
3. Configure Google Auth Platform > Branding and Audience. In Testing
   mode, add your Google account as a test user. Google may require
   app verification if you later make this available to other people.
4. Create an **OAuth 2.0 Web application** client in Google Auth Platform >
   Clients. Authorize JavaScript origin \`http://localhost:8000\` and
   redirect URI \`http://localhost:8000/api/google-photos/callback\`.
   If running another port, use that port consistently.
5. Start \`./serve.sh\`, open http://localhost:8000/art/manage/ and
   select Studio Assets > Import directly from Google Photos. Paste your
   client ID and secret and click **Save local Google configuration**.
   Secrets and tokens remain under ignored \`.art-private/google-photos/\`;
   never commit this folder.
6. Click **Connect Google Photos** and complete Google authorization in
   the pop-up. This is a separate authorization from Google Drive.

### Day-to-day use

1. Select a work and/or check artwork associations under Studio Assets.
2. Set visibility to **See related** or **Keep local**.
3. Choose photos, use Google Photos to select up to 50 photos or videos, and
   press **Done** in Google Photos.
4. Back in Studio Assets, untick unwanted items and click **Import selected**.
   The selected bytes are copied to local Studio Assets and associated with
   the checked artworks, without changing previously published relations.
5. Each file must fit the existing 25 MB limit. A failed import is reported.
   Successfully imported files remain in the local archive, with Google
   Photos originals untouched.
6. To publish visible assets, review and commit
   \`art/data/studio-related.json\` and \`art/assets/studio/\` as usual.

### Limitations and privacy

- Images use Google's \`=d\` original-image download (minus location metadata);
  videos use \`=dv\` (high quality transcoded format). Video formats may exceed
  the current Studio Assets limit.
- The selected media URL normally remains usable for about 60 minutes; import
  soon after picking. Photos API access is limited to the selected media.
- Google OAuth testing-mode refresh tokens may expire; reconnect as necessary.
- Disconnect clears the local token but never deletes imported artworks or assets.
- Google API client credentials cannot be created automatically by this program.
  OAuth setup is a one-time action in your Google Cloud account.
- Live importing requires that setup and your explicit Google consent.
  Local regression tests use simulated Google responses, not your Photos data.

Official docs: https://developers.google.com/photos/picker/guides/get-started-picker
and https://developers.google.com/photos/picker/guides/media-items .


## Google Photos in the normal artwork Upload menu

Google Photos now has **two explicit destinations**:

- **Upload > Choose images from Google Photos**: create new, independent
  published artworks in the Room selected in the normal Upload form.
  These receive standard artwork IDs and use the form's Room, Medium,
  Subgroup and Caption fields. For a single selected photo, the Title field
  sets the title. For multiple selected photos, the source filenames supply
  separate titles. Feature and homepage-hero options are available only
  when importing one image, to avoid silently choosing one in a batch.
- **Studio Assets > Import directly from Google Photos**: archive supporting
  media and optionally link them under the existing **See related** action.
  These uploads do not create new Room artwork cards.

Both options use the **same Google OAuth connection and Picker API**. Configure
and authorize it once in Studio Assets. Then use either import destination,
according to whether the material is a published artwork or supporting material.

The normal Upload menu accepts only JPEG, PNG, WebP or GIF images, matching
the existing artwork image uploader. For videos, HEIC files and supporting
documents, use Studio Assets. Each file has the same 25 MB transfer limit.

A normal Room import appends new artwork records and rebuilds the static
gallery. It never changes existing related artwork groups. Newly imported
Room works become public only when the generated assets, catalogue and
gallery pages are committed and pushed.

The Google Photos connection is independent of Github, and uploading one
photo in either area does not import it into the other automatically.
