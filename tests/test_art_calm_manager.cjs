"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const manager=read("art/manage/index.html");
const js=read("art/assets/art-manager-calm.js");
const server=read("tools/art_curator_server.py");
const transfer=read("tools/art_transfer.py");
const publish=read("tools/art_publish.py");
const gallery=read("tools/build_art_gallery_static.py");
const related=JSON.parse(read("art/data/related-public.json"));
const arts=JSON.parse(read("art/data/artworks.json"));
assert.ok(arts.artworks.length>0,"Existing paintings preserved");
assert.ok(related.sets.length>0,"Existing published related groups preserved");
for(const name of ["addButton","organiseButton","publishButton"]){
  assert.equal((manager.match(new RegExp('id="'+name+'"',"g"))||[]).length,1,name+" is one clear action");
}
assert.match(manager,/data-view="gallery"/);
assert.match(manager,/data-view="studio"/);
assert.match(manager,/id="grid"/);
assert.match(manager,/id="moveDialog"/);
assert.match(manager,/id="relateDialog"/);
assert.match(manager,/id="publishDialog"/);
assert.match(manager,/art-manager-calm\.js/);
assert.match(manager,/art-manager-calm\.css/);
assert.doesNotMatch(manager,/(?:google-photos|Google Photos|Feature<\/summary>|unifiedUploadMenu|art-related-manager\.js)/i);
assert.doesNotMatch(js,/google-photos/i,"No picker or Google OAuth dependency");
assert.match(js,/\/api\/studio-upload/,"Local-only Studio upload remains");
assert.match(manager,/id="addReference"/,"A simple Reference marker appears when adding to Studio");
assert.match(manager,/id="editReference"/,"A simple Reference marker appears when editing Studio");
assert.doesNotMatch(manager,/id="editVisibility"|id="relatePublishStudio"/,
 "Public visibility is not an unrelated permanent editing control");
assert.match(js,/makeStudioPublic:makePublic/,"Studio sharing is explicit when a Gallery relation is saved");
assert.match(js,/kind==="reference"/,"Legacy references stay usable in the same Studio Relate chooser");
assert.match(server,/studio_library_items\(\)/,"Studio list includes legacy private references");
assert.match(server,/studio_update_legacy_reference/,"Legacy reference edits preserve the original archive");
assert.match(server,/studio_library_reorder/,"Studio sorting spans both collections");

assert.match(js,/\/api\/add-artwork/,"Local-only gallery upload remains");
assert.match(js,/visibility:"private"/,"Studio imports must be private by default");
assert.match(js,/\/api\/move-art/,"Gallery and Studio are reversible");
assert.doesNotMatch(manager,/id="positionInput"|id="applyPosition"/,
 "No manual position-number fields in the artist-facing Manager");
assert.doesNotMatch(js,/positionInput|applyPosition|repositionSelected/,
 "Reordering is direct drag and drop, without extra numeric controls");
assert.match(js,/draggedWork.keys.length!==1\)return false/,
 "Single artwork can be dragged without changing Manager mode");
assert.doesNotMatch(js,/roomFilter"\)\.value===src\.collection/,
 "All Rooms is a supported starting view for reordering");
assert.doesNotMatch(js,/search"\)\.value\.trim\(\)\)return false/,
 "Search filter does not disable drag-and-drop");
assert.match(js,/\/api\/reorder-collection/,"Gallery order saved through existing API");
assert.match(js,/\/api\/reorder-studio/,"Studio order saved through private API");
assert.match(js,/reorder-before/,"Gallery and Studio cards show before/after drop position");
assert.match(js,/insertBeforeOrAfter/,"Drop between artworks changes local sequence");
assert.match(server,/\/api\/reorder-studio/,"Private Studio reorder endpoint exists");
assert.match(server,/Gallery order has changed/,"Gallery order rejects stale inventories");

assert.match(js,/dragstart/,"Artworks support drag to Studio");
assert.match(js,/drop-ready/,"Studio tab visually accepts artwork drop");
assert.match(js,/Move → Studio/,"Transfer action is clearly labelled");
assert.match(js,/openMove\(\)/,"Dropping uses confirmation dialog");
assert.match(js,/setOrganiseMode/,"Organise supports multiple selection");
assert.match(js,/selectedKeys\(\)/,"Move and Relate use selected work batches");
assert.match(js,/\/api\/save-related-group/,"Existing canonical relations remain manageable");
assert.match(js,/\/api\/art-publish\/review/,"Explicit public review present");
assert.match(js,/\/api\/art-publish\/push/,"Push confirmation available");
assert.match(server,/\/api\/move-art/,"Move API enabled");
assert.doesNotMatch(server,/google_photos|\/api\/google-photos/,"Google OAuth endpoints removed");
assert.match(transfer,/originArtwork/,"Original artwork metadata preserved");
assert.match(transfer,/visibility": "private"/,"Transferred artwork private by default");
assert.match(transfer,/rewrite_members/,"Canonical related group IDs updated");
assert.match(transfer,/hashlib\.sha256/,"Private image copy verified");
assert.match(publish,/def publish_review/,"Outgoing changes reviewed before push");
assert.match(publish,/if confirmation != "PUBLISH"/,"Publication requires explicit confirmation");
assert.match(gallery,/COLLECTIONS = \[/,"The five public Rooms remain");
assert.doesNotMatch(gallery,/COLLECTIONS\.append\([^)]*Studio Assets/);
for(const old of [
 "art/assets/art-google-photos-upload.js",
 "tools/art_google_photos.py",
 "art/google-photos/index.html",
 "art/assets/art-related-manager.js",
 "art/assets/art-studio-manager.js"
])assert.ok(!fs.existsSync(old),old+" was retired");
console.log("PASS: calm Gallery and Studio Manager, Mac-only imports, reversible move, canonical relations, reviewed publishing.");
