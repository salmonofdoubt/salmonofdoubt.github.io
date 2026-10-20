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


if __name__ == "__main__":
    unittest.main()
