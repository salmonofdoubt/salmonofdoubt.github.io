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
            (transfer,"ROOT",root),(transfer,"ART",self.art),(transfer,"ARTWORKS",self.artworks),
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

    def test_missing_private_related_master_blocks_dangerous_move(self):
        self.related_master.unlink()
        public=self.data / "related-public.json"
        public.write_text(json.dumps({"sets":[{"id":"public","members":[
            {"kind":"artwork","id":"portrait-1"},
            {"kind":"artwork","id":"drawing-2"}
        ]}]}))
        before=self.artworks.read_bytes()
        with self.assertRaisesRegex(ValueError,"Restore the private Related archive"):
            transfer.to_studio("portrait-1")
        self.assertEqual(before,self.artworks.read_bytes())

    def test_wordpress_photo_can_be_moved_into_private_studio(self):
        external = "https://qiquantum.wordpress.com/wp-content/uploads/2022/08/portrait.jpg"
        entries=json.loads(self.artworks.read_text())
        entries["artworks"][0]["image"]=external
        entries["artworks"][0]["thumb"]=external
        entries["artworks"][0]["sourceUrl"]=external
        self.artworks.write_text(json.dumps(entries))
        with patch.object(transfer,"fetch_wordpress_image",
                          return_value=("portrait.jpg",b"\xff\xd8\xffpublic-wordpress-photo")) as fetch:
            moved=transfer.to_studio("portrait-1")
        fetch.assert_called_once_with(external)
        self.assertTrue(moved["originRemoteImage"])
        self.assertFalse(moved["publicImageRemoved"])
        self.assertIn("WordPress",moved["warning"])
        studio_item=studio.find_asset(moved["id"])
        self.assertEqual("private",studio_item["visibility"])
        self.assertEqual(external,studio_item["originArtwork"]["image"])
        self.assertEqual(b"\xff\xd8\xffpublic-wordpress-photo",
                         studio.file_for_asset(studio_item).read_bytes())
        self.assertEqual("studio",self.read_members()[0]["kind"])

    def test_wordpress_photo_returns_to_gallery_as_local_file(self):
        external="https://qiquantum.wordpress.com/wp-content/uploads/2023/10/portrait.jpg"
        entries=json.loads(self.artworks.read_text())
        entries["artworks"][0]["image"]=external
        entries["artworks"][0]["thumb"]=external
        self.artworks.write_text(json.dumps(entries))
        with patch.object(transfer,"fetch_wordpress_image",
                          return_value=("portrait.jpg",b"\xff\xd8\xffimage")):
            moved=transfer.to_studio("portrait-1")
        restored=transfer.to_gallery(moved["id"],"Oil Paintings")
        self.assertEqual("portrait-1",restored["id"])
        painting=next(a for a in self.read_artworks() if a["id"]=="portrait-1")
        self.assertTrue(painting["image"].startswith("assets/works/oil-paintings/"))
        self.assertEqual(external,painting["sourceUrl"])
        self.assertEqual(painting["image"],painting["thumb"])
        self.assertEqual(b"\xff\xd8\xffimage",(self.art / painting["image"]).read_bytes())
        self.assertEqual("artwork",self.read_members()[0]["kind"])

    def test_wordpress_fetch_rejects_unknown_or_unencrypted_hosts(self):
        self.assertTrue(transfer.allowed_wordpress_url(
            "https://qiquantum.wordpress.com/wp-content/uploads/2022/01/study.jpg"))
        self.assertFalse(transfer.allowed_wordpress_url("http://qiquantum.wordpress.com/media.jpg"))
        self.assertFalse(transfer.allowed_wordpress_url("https://localhost/private.jpg"))
        self.assertFalse(transfer.allowed_wordpress_url("https://evil.com/fake.jpg"))
        with self.assertRaisesRegex(ValueError,"WordPress library"):
            transfer.fetch_wordpress_image("https://evil.com/study.jpg")

    def test_legacy_repository_image_path_can_be_archived(self):
        image=self.art.parent / "images" / "001-2.jpg"
        image.parent.mkdir(parents=True)
        image.write_bytes(b"legacy-image-bytes")
        entries=json.loads(self.artworks.read_text())
        entries["artworks"][0]["image"]="../images/001-2.jpg"
        entries["artworks"][0]["thumb"]="../images/001-2.jpg"
        self.artworks.write_text(json.dumps(entries))
        moved=transfer.to_studio("portrait-1")
        self.assertTrue(image.is_file())
        self.assertEqual(b"legacy-image-bytes",
                         studio.file_for_asset(studio.find_asset(moved["id"])).read_bytes())
        transfer.to_gallery(moved["id"],"Oil Paintings")
        self.assertEqual("../images/001-2.jpg",
                         next(a for a in self.read_artworks() if a["id"]=="portrait-1")["image"])

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
