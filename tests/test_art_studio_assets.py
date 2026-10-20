"""Regression tests for Studio Assets and existing related-work isolation."""
import base64
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import art_studio_assets as studio


class StudioAssetsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        art = root / "art"
        self.data_dir = art / "data"
        self.data_dir.mkdir(parents=True)
        self.artworks = self.data_dir / "artworks.json"
        self.artworks.write_text(json.dumps({
            "artworks": [
                {"id": "drawing-a", "title": "Drawing A",
                 "collection": "Drawings", "image": "assets/works/drawing.jpg", "status": "active"},
                {"id": "painting-b", "title": "Painting B",
                 "collection": "Oil Paintings", "image": "assets/works/painting.jpg"},
                {"id": "hidden-c", "title": "Hidden C",
                 "image": "assets/works/hidden.jpg", "status": "hidden"},
            ]
        }))
        self.legacy = self.data_dir / "related-public.json"
        self.legacy.write_text('{"version":1,"sets":[{"id":"original","members":[{"kind":"artwork","id":"drawing-a"}]}]}')
        self.legacy_before = self.legacy.read_bytes()
        index = root / ".art-private" / "studio" / "assets.json"
        paths = {
            "INDEX": index, "PRIVATE_FILES": index.parent / "files",
            "PUBLIC_INDEX": self.data_dir / "studio-related.json",
            "PUBLIC_FILES": art / "assets" / "studio", "ARTWORKS": self.artworks,
        }
        for name, value in paths.items():
            p = patch.object(studio, name, value)
            p.start()
            self.addCleanup(p.stop)

    def upload(self, name, links, visibility="related"):
        return studio.upload_asset({
            "filename": name, "title": name, "note": "Process material",
            "artworkIds": links, "visibility": visibility,
            "fileDataUrl": "data:application/octet-stream;base64," +
                base64.b64encode(b"studio test bytes").decode("ascii"),
        })

    def test_links_to_multiple_artworks_and_preserves_old_relationships(self):
        entry = self.upload("sketch.jpg", ["drawing-a", "painting-b"])
        projection = studio.build_public_studio()
        self.assertEqual(2, len(projection["sets"]))
        self.assertEqual("studio:" + "drawing-a", projection["sets"][0]["id"])
        self.assertEqual(["artwork", "studio"],
                         [x["kind"] for x in projection["sets"][0]["members"]])
        self.assertEqual(entry["id"], projection["sets"][0]["members"][1]["id"])
        self.assertEqual(self.legacy_before, self.legacy.read_bytes())
        self.assertTrue((studio.PUBLIC_FILES / entry["storedName"]).is_file())

    def test_unassigned_hidden_and_private_do_not_publish(self):
        self.upload("unassigned.png", [])
        self.upload("secret.jpg", ["drawing-a"], visibility="private")
        self.upload("hidden.jpg", ["hidden-c"])
        self.assertEqual([], studio.build_public_studio()["sets"])
        self.assertEqual(self.legacy_before, self.legacy.read_bytes())

    def test_unsupported_active_content_remains_private(self):
        item = self.upload("inject.html", ["drawing-a"])
        self.assertEqual("private", item["visibility"])
        self.assertEqual([], studio.build_public_studio()["sets"])
        with self.assertRaises(ValueError):
            studio.update_asset({"id": item["id"], "visibility": "related"})

    def test_update_links_and_remove_only_owned_blob(self):
        item = self.upload("underpainting.pdf", ["drawing-a"])
        studio.build_public_studio()
        studio.update_asset({"id": item["id"], "artworkIds": ["painting-b"],
                             "title": "Stage 1", "note": "Burnt sienna"})
        projection = studio.build_public_studio()
        self.assertEqual("studio:painting-b", projection["sets"][0]["id"])
        self.assertEqual("Stage 1", projection["sets"][0]["members"][1]["title"])
        studio.delete_asset(item["id"])
        self.assertEqual([], studio.build_public_studio()["sets"])
        self.assertFalse((studio.PUBLIC_FILES / item["storedName"]).exists())
        self.assertEqual(self.legacy_before, self.legacy.read_bytes())

    def test_existing_published_projection_is_not_wiped_without_private_index(self):
        existing = {"version": 1, "sets": [{"id": "studio:old", "members": []}]}
        studio.PUBLIC_INDEX.write_text(json.dumps(existing))
        self.assertEqual(existing, studio.build_public_studio())
        self.assertEqual(existing, json.loads(studio.PUBLIC_INDEX.read_text()))


    def test_bulk_link_preserves_each_asset_existing_relationships(self):
        one = self.upload("first-sketch.jpg", ["drawing-a"])
        two = self.upload("underpainting.jpg", ["painting-b"])
        three = self.upload("reference.jpg", [])
        outcome = studio.bulk_link_assets({
            "assetIds": [one["id"], two["id"], three["id"]],
            "artworkIds": ["drawing-a"], "action": "add",
        })
        self.assertEqual(3, outcome["selectedCount"])
        self.assertEqual(2, outcome["changedCount"])
        asset_index = {a["id"]: a for a in studio.load_assets()["assets"]}
        self.assertEqual(["drawing-a"], asset_index[one["id"]]["artworkIds"])
        self.assertEqual(["painting-b", "drawing-a"],
                         asset_index[two["id"]]["artworkIds"])
        self.assertEqual(["drawing-a"], asset_index[three["id"]]["artworkIds"])
        projection = studio.build_public_studio()
        self.assertEqual(3, len(projection["sets"][0]["members"]) - 1)
        self.assertEqual(self.legacy_before, self.legacy.read_bytes())

    def test_bulk_link_is_atomic_on_missing_asset_or_invalid_target(self):
        first = self.upload("first.jpg", [])
        second = self.upload("second.jpg", ["painting-b"])
        before = studio.INDEX.read_bytes()
        with self.assertRaisesRegex(ValueError, "Unknown Studio Asset ID"):
            studio.bulk_link_assets({
                "assetIds": [first["id"], "asset-nonexistent"],
                "artworkIds": ["drawing-a"], "action": "add"
            })
        self.assertEqual(before, studio.INDEX.read_bytes())
        with self.assertRaisesRegex(ValueError, "Unknown artwork ID"):
            studio.bulk_link_assets({
                "assetIds": [first["id"], second["id"]],
                "artworkIds": ["not-an-artwork"], "action": "add"
            })
        self.assertEqual(before, studio.INDEX.read_bytes())
        self.assertEqual(self.legacy_before, self.legacy.read_bytes())

    def test_bulk_link_keeps_private_assets_private_by_default(self):
        private = self.upload("private.jpg", [], visibility="private")
        public = self.upload("public.jpg", [])
        studio.bulk_link_assets({
            "assetIds": [private["id"], public["id"]],
            "artworkIds": ["painting-b"], "action": "add",
        })
        assets = {a["id"]: a for a in studio.load_assets()["assets"]}
        self.assertEqual("private", assets[private["id"]]["visibility"])
        self.assertEqual("related", assets[public["id"]]["visibility"])
        members = studio.build_public_studio()["sets"][0]["members"]
        self.assertEqual([public["id"]],
                         [x["id"] for x in members if x["kind"] == "studio"])

    def test_bulk_link_publication_is_explicit_and_validated(self):
        private = self.upload("private.jpg", [], visibility="private")
        unsupported = self.upload("notes.html", [], visibility="private")
        before = studio.INDEX.read_bytes()
        with self.assertRaisesRegex(ValueError, "File type cannot be published"):
            studio.bulk_link_assets({
                "assetIds": [private["id"], unsupported["id"]],
                "artworkIds": ["painting-b"], "action": "add",
                "makeRelated": True,
            })
        self.assertEqual(before, studio.INDEX.read_bytes())
        studio.bulk_link_assets({
            "assetIds": [private["id"]],
            "artworkIds": ["painting-b"], "action": "add",
            "makeRelated": True,
        })
        self.assertEqual("related", studio.load_assets()["assets"][0]["visibility"])
        self.assertEqual(self.legacy_before, self.legacy.read_bytes())

    def test_bulk_unlink_removes_only_requested_artwork(self):
        first = self.upload("first.jpg", ["drawing-a", "painting-b"])
        second = self.upload("second.jpg", ["painting-b"])
        studio.bulk_link_assets({
            "assetIds": [first["id"], second["id"]],
            "artworkIds": ["drawing-a"], "action": "remove",
        })
        items = {a["id"]: a for a in studio.load_assets()["assets"]}
        self.assertEqual(["painting-b"], items[first["id"]]["artworkIds"])
        self.assertEqual(["painting-b"], items[second["id"]]["artworkIds"])
        self.assertEqual(self.legacy_before, self.legacy.read_bytes())



if __name__ == "__main__":
    unittest.main()
