"""No real artwork files are modified. Local, disposable test repository only."""
import base64
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1] / "tools"))
import art_transfer as transfer
import art_studio_assets as studio
import art_related as related


class StudioGalleryTransferTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root=Path(self.tmp.name)
        self.art=root / "art"
        self.data=self.art / "data"
        self.data.mkdir(parents=True)
        original=self.art / "assets" / "works" / "oil-paintings" / "study.jpg"
        original.parent.mkdir(parents=True)
        original.write_bytes(b"original-photo-bytes")
        self.original=original
        self.artworks=self.data / "artworks.json"
        self.curation=self.data / "art-curation.json"
        self.studio_index=root / ".art-private" / "studio" / "assets.json"
        self.studio_files=root / ".art-private" / "studio" / "files"
        self.related_master=root / ".art-private" / "related" / "related-master.json"
        self.related_master.parent.mkdir(parents=True)
        self.painting={"id":"portrait-1","title":"Pope study","collection":"Oil Paintings",
                       "image":"assets/works/oil-paintings/study.jpg",
                       "thumb":"assets/works/oil-paintings/study.jpg",
                       "medium":"Oil","status":"active","text":"First layer"}
        self.other={"id":"drawing-2","title":"Drawing","collection":"Drawings",
                    "image":"assets/works/drawings/sketch.jpg","status":"active"}
        self.artworks.write_text(json.dumps({"artworks":[self.painting,self.other]}))
        self.curation.write_text(json.dumps({
            "homepageHero":{"id":"portrait-1","image":self.painting["image"]},
            "collections":{"Oil Paintings":{"feature":{"id":"portrait-1","image":self.painting["image"]}}}}))
        self.related_master.write_text(json.dumps({"version":1,"references":[],"sets":[{
            "id":"legacy","title":"Portrait progress",
            "members":[{"kind":"artwork","id":"portrait-1","role":"related","note":"first"},
                       {"kind":"artwork","id":"drawing-2","role":"related","note":""}]}]}))
        replacements=[
            (transfer,"ART",self.art),(transfer,"ARTWORKS",self.artworks),
            (transfer,"CURATION",self.curation),(studio,"ARTWORKS",self.artworks),
            (studio,"INDEX",self.studio_index),(studio,"PRIVATE_FILES",self.studio_files),
            (studio,"PUBLIC_FILES",self.art / "assets" / "studio"),
            (studio,"PUBLIC_INDEX",self.data / "studio-related.json"),
            (related,"ARTWORKS_PATH",self.artworks),(related,"MASTER_PATH",self.related_master),
            (related,"PRIVATE_REFERENCES",root / ".art-private" / "related" / "references"),
            (related,"PUBLIC_PATH",self.data / "related-public.json"),
            (related,"PUBLIC_REFERENCES",self.art / "assets" / "related"),
        ]
        for obj,attr,value in replacements:
            p=patch.object(obj,attr,value)
            p.start();self.addCleanup(p.stop)

    def read_artworks(self):
        return json.loads(self.artworks.read_text())["artworks"]

    def read_members(self):
        return json.loads(self.related_master.read_text())["sets"][0]["members"]

    def test_move_gallery_to_private_studio_preserves_full_record_and_group(self):
        result=transfer.to_studio("portrait-1")
        self.assertTrue(result["publicImageRemoved"])
        self.assertFalse(self.original.exists())
        self.assertEqual(["drawing-2"],[a["id"] for a in self.read_artworks()])
        assets=studio.load_assets()["assets"]
        self.assertEqual(1,len(assets))
        self.assertEqual("private",assets[0]["visibility"])
        self.assertEqual(self.painting,assets[0]["originArtwork"])
        self.assertEqual(b"original-photo-bytes",studio.file_for_asset(assets[0]).read_bytes())
        self.assertEqual("studio",self.read_members()[0]["kind"])
        self.assertEqual(assets[0]["id"],self.read_members()[0]["id"])
        self.assertEqual("drawing-2",self.read_members()[1]["id"])
        self.assertEqual({},json.loads(self.curation.read_text())["homepageHero"])

    def test_move_back_restores_identity_media_and_legacy_relations(self):
        moved=transfer.to_studio("portrait-1")
        restored=transfer.to_gallery(moved["id"],"Oil Paintings")
        self.assertEqual("portrait-1",restored["id"])
        self.assertEqual(b"original-photo-bytes",self.original.read_bytes())
        self.assertEqual(self.painting,next(a for a in self.read_artworks() if a["id"]=="portrait-1"))
        self.assertEqual(["artwork","artwork"],[m["kind"] for m in self.read_members()])
        self.assertEqual("portrait-1",self.read_members()[0]["id"])
        self.assertEqual([],studio.load_assets()["assets"])

    def test_shared_gallery_image_is_not_deleted(self):
        entries=json.loads(self.artworks.read_text())
        entries["artworks"][1]["image"]=self.painting["image"]
        self.artworks.write_text(json.dumps(entries))
        moved=transfer.to_studio("portrait-1")
        self.assertFalse(moved["publicImageRemoved"])
        self.assertTrue(self.original.is_file())
        self.assertEqual("private",studio.find_asset(moved["id"])["visibility"])

    def test_missing_image_refuses_to_remove_artwork(self):
        self.original.unlink()
        before=self.artworks.read_bytes()
        with self.assertRaisesRegex(ValueError,"missing"):
            transfer.to_studio("portrait-1")
        self.assertEqual(before,self.artworks.read_bytes())
        self.assertFalse(self.studio_index.exists())

    def test_existing_private_studio_image_can_move_to_gallery(self):
        created=studio.upload_asset({
            "filename":"study.jpg","fileDataUrl":"data:image/jpeg;base64,"+
                base64.b64encode(b"an-exploratory-image").decode(),
            "title":"Studio sketch","note":"Drypoint test","visibility":"private","artworkIds":[]
        })
        result=transfer.to_gallery(created["id"],"Drawings")
        item=next(a for a in self.read_artworks() if a["id"]==result["id"])
        self.assertEqual("Drawings",item["collection"])
        self.assertEqual("Studio sketch",item["title"])
        self.assertEqual("Drypoint test",item["text"])
        self.assertEqual(b"an-exploratory-image",(self.art / item["image"]).read_bytes())
        self.assertFalse(studio.find_asset(created["id"]))

if __name__=="__main__":
    unittest.main()
