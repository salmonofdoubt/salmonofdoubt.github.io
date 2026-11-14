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
assert.match(js,/\/api\/add-artwork/,"Local-only gallery upload remains");
assert.match(js,/visibility:"private"/,"Studio imports must be private by default");
assert.match(js,/\/api\/move-art/,"Gallery and Studio are reversible");
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
