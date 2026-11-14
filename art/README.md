# DiAndré Art: your Studio

The public artwork website is https://salmonofdoubt.github.io/art/.
Your private, local Manager is http://localhost:8000/art/manage/.

**Start ARTS on your Mac:**

\`\`\`bash
cd ~/i_VC/salmonofdoubt.github.io
./serve.sh
\`\`\`

The Manager has three main buttons: **Add**, **Organise**, **Publish**.

## Everyday operation (Mac files only)

**Add:** Choose local image files, and choose either **Gallery** or **Studio**.
Gallery images are added to one of five exhibition Rooms. Studio files are
private by default and do not appear as independent public artworks.

**Organise:** Click **Organise**, then tap several thumbnails and use **Move** or **Relate** once. Click **Done selecting** to return to normal. For one work, select its thumbnail and click **Edit** to change its title, note, Room or visibility,
**Move** it between Gallery and Studio, or **Relate** it to other artworks
and studies. Select multiple works in a related group. Existing relationships
are kept when moving a work between Gallery and Studio.

**Publish:** The local Manager saves and rebuilds immediately. Publication
requires reviewing what will become public, confirming a local Git commit,
and separately confirming the GitHub push.

**Moving a painting to Studio:** ARTS saves the full artwork record and a
verified private copy. The work disappears from the current Gallery once
those changes are published. For unique images in the managed Gallery works
folder, it also removes the current public image file. **Previously public
copies can survive in GitHub history, browser caches, and other archives.**
Moving to Studio must not be mistaken for retroactively erasing a published
image everywhere.

**Moving back:** Select the item in Studio, click Move, and pick the Room.
Artwork identity and saved related-group membership are restored when the
work had originally come from Gallery. Studio files imported directly can
be promoted into new Gallery artworks.

## Your two data stores

- Public GitHub Gallery source: \`art/data/artworks.json\`,
  \`art/data/art-curation.json\`, \`art/assets/works/\`.
- Private local Studio originals: \`.art-private/studio/files/\`,
  \`.art-private/studio/assets.json\`.
- Private editable relationship master:
  \`.art-private/related/related-master.json\`.

The public Gallery contains five Rooms: Oil Paintings, Watercolours,
Drawings, Experimental, and GeoSpatial Imagery. Studio is a local-only Room.

**Back up your entire \`.art-private/\` directory independently**. GitHub
cannot recover it. The transferred source record is in the private Studio
index, so restore that backup before rebuilding on a new Mac.

Google Photos Picker and Google OAuth are no longer part of ARTS. Existing
local Google credentials are *not* deleted by upgrading the source code:
you can securely remove or revoke them separately after verifying your
backups. Never commit credentials or \`.art-private/\` to GitHub.

## If the Manager looks old

Stop your local server with Ctrl+C, then:

\`\`\`bash
cd ~/i_VC/salmonofdoubt.github.io
git status --short
git pull --ff-only origin master
./serve.sh
\`\`\`

If Git reports conflicts, **do not reset, delete, or discard local artwork
files**. Resolve safely before retrying. Reload the page with Cmd+Shift+R.

## Developers

Local Python server: \`tools/art_curator_server.py\`.
Artwork transfer: \`tools/art_transfer.py\`.
Local publication safeguards: \`tools/art_publish.py\`.
Private Studio: \`tools/art_studio_assets.py\`.
Canonical related groups: \`tools/art_related.py\`.
Static public builder: \`tools/build_art_gallery_static.py\`.
New Manager: \`art/manage/index.html\`,
\`art/assets/art-manager-calm.js\`, and \`art/assets/art-manager-calm.css\`.

Test via \`.github/workflows/art-studio-assets-ci.yml\`.
