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

**Remove an unwanted work or a duplicate:** Select any Gallery artwork,
Studio item or old Ref, then click **Remove** and confirm. For several
items, click **Organise**, select those items and click Remove. You can
also click **Duplicates** next to Search to see *exact* file matches or
records using the same original image URL across the entire library.
Review each group and use Remove on unwanted copies only. There is no
automatic mass deletion and similarly looking but differently encoded
photographs are **not** assumed to be duplicates.

ARTS first archives the complete record and a verified private media copy
under `.art-private/trash/`, then removes the selected entry and its
canonical links. **Undo last removal** restores the most recent item
and its original links when those groups still exist. The local Trash is
persistent and must be included in Mac backups. A file shared by other
works is never deleted from its shared location. Removing a WordPress
gallery entry does not delete its WordPress-hosted original. Previously
published images may remain in Git history and external caches.

Gallery changes are **not public until you Publish**. No private Trash
files, original Reference files or Studio secrets are included in the
publishing allowlist.

**Your old references live in Studio:** Open **Studio**. Existing references
from the previous Refs archive appear among your studies with a **Ref** label.
No old file is moved, duplicated or deleted, and existing related groups keep
their identifiers. Select an item, click **Edit**, and tick **Reference**
to mark it; untick it for an ordinary study. When adding Mac files to Studio,
the same optional **Reference** checkbox is available. All new Studio files
are private by default.

**Show a reference with a Gallery painting:** Select a painting, click
**Relate**, and pick as many Studio references or studies as you like.
If any of those files are private, the Manager asks permission **once**
before allowing them in the Gallery's **See related** view. You still must
choose **Publish** separately. Merely marking a file Reference or storing
it in Studio never publishes it. A Reference stays in Studio rather than
becoming a standalone Gallery Room artwork.

**Your originals remain private:** Old reference files still live under
`.art-private/related/references/`, and other Studio files under
`.art-private/studio/files/`. Back up both directories and their indexes.
Previously published copies can remain in Git history; unpublished
originals are never sent to GitHub automatically.

**Rearrange your art:** Just grab a thumbnail and drop it on another
thumbnail. A thin edge highlight shows where it will land. This works while
viewing **All Rooms**, one Room, or search results, as long as the two
artworks belong to the same Gallery Room. No Organise button, position
number or extra screen is needed. The complete Room sequence is saved on
your Mac and can be published when ready.

**Move a painting into Studio:** Grab the thumbnail and drop it onto the
**Studio** tab, then confirm. Or click a painting and choose **Move → Studio**.

**Rearrange Studio:** Grab one thumbnail and drop it on another. The order
stays private on your Mac.

**Order inside See related:** Select a work, click **Relate**, and use
the ↑ / ↓ controls next to items in that group's sequence.

**Publish:** The local Manager saves and rebuilds immediately. Publication
requires reviewing what will become public, confirming a local Git commit,
and separately confirming the GitHub push.

**Moving a painting to Studio:** Click a Gallery thumbnail and choose
**Move → Studio**, or drag the thumbnail onto the **Studio** tab. Confirm
the move. ARTS saves the full artwork record and a verified private copy.
For historic artworks whose image is still hosted on QIQUANTUM WordPress,
ARTS downloads a private copy first. You need an Internet connection
for this one-time retrieval. **The original WordPress image remains public**
until separately removed from WordPress. If retrieval fails, nothing is
moved; use a locally saved original to replace the image.
 The work disappears from the current Gallery once
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
