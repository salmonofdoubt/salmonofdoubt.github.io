/* Guard the single-entry architecture and legacy relationship preservation. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const p=x=>fs.readFileSync(x,"utf8");
const markup=p("art/manage/index.html");
const studio=p("art/assets/art-studio-manager.js");
const picker=p("art/assets/art-google-photos-upload.js");
const switcher=p("art/assets/art-upload-destination.js");
const server=p("tools/art_curator_server.py");
const google=p("tools/art_google_photos.py");
const related=p("art/data/related-public.json");

assert.equal((markup.match(/id="newFile"/g)||[]).length,1,"One Mac file input");
assert.equal((markup.match(/id="studioUploadPanel"/g)||[]).length,1,"Studio lives under Upload");
assert.match(markup,/data-art-destination="room"/);
assert.match(markup,/data-art-destination="studio"/);
assert.match(markup,/populateSelect\("collectionFilter", \["All", \.\.\.collections, "Studio Assets"\]/,
  "Studio Assets appears as manager-only Room");
const relatedManager=p("art/assets/art-related-manager.js");
const relatedBackend=p("tools/art_related.py");
assert.match(relatedManager,/selectedStudioIds/, "Relate selector retains Studio Asset selections");
assert.match(relatedManager,/showStudioRoomForRelate/, "Relate toolbar opens secret Studio Room");
assert.match(relatedManager,/kind === "studio"/, "Mixed groups carry Studio members");
assert.match(relatedBackend,/KINDS = \{"artwork", "reference", "studio"\}/,
  "Canonical relation schema supports Studio members");
assert.match(relatedBackend,/make_studio_public/, "Explicit publication consent supported");
assert.doesNotMatch(p("tools/build_art_gallery_static.py"),/COLLECTIONS\.append\([^)]*Studio Assets/,
  "Studio is not a public collection");

assert.match(markup,/id="unifiedUploadMenu"/);
assert.doesNotMatch(studio,/studio-manager-button|studioGooglePick|studioGoogleImport|showModal/);
assert.match(studio,/window.artStudioUpload =/);
assert.match(studio,/id="studioSelectVisible"/, "Select all matching assets present");
assert.match(studio,/id="studioBulkLink"/, "Bulk link button present");
assert.match(studio,/id="studioBulkUnlink"/, "Bulk unlink button present");
assert.match(studio,/data-bulk-asset/, "Each asset has a bulk-selection checkbox");
assert.match(studio,/\/api\/studio-bulk-link/, "One atomic bulk API call");

assert.match(studio,/host.appendChild\(dialog\)/);
assert.match(picker,/\/api\/google-photos\/import-artworks/);
assert.doesNotMatch(picker,/id="roomGoogleImport"/, "No second Google Photos import button");
assert.match(picker,/window.artGooglePhotosSelection =/, "Google selection shared with final submit");
assert.match(picker,/hasPending/, "Google selection remains staged");
assert.match(picker,/roomGoogleStage/, "Stage cue tells the user when to submit");
assert.match(markup,/window.artGooglePhotosSelection\?\.hasPending\(\)/, "Public Room submit uses staged Photos");
assert.match(studio,/window.artGooglePhotosSelection\?\.hasPending\(\)/, "Studio submit uses staged Photos");
assert.match(picker,/roomButton\.disabled=importing/, "No duplicate work submissions after import");

assert.match(picker,/\/api\/google-photos\/import"/);
assert.match(picker,/value\.importTargets/);
assert.match(switcher,/art-upload-destination-changed/);
assert.match(switcher,/new Event\("art-studio-activate"\)/);
assert.match(server,/\/api\/google-photos\/import-artworks/);
assert.match(server,/\/api\/google-photos\/import"/);
assert.match(google,/"importTargets": \["room", "studio"\]/);
assert.ok(JSON.parse(related).sets.length>0,"Pre-existing public relations retained");
console.log("PASS: one Upload menu, one Google Photos selector, two destinations, legacy relations retained");
