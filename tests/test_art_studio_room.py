"""Studio Assets selectable as a virtual Room in the existing Relate system."""
import base64
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import art_related as related
import art_studio_assets as studio


class StudioRoomRelationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        art = root / "art"
        data = art / "data"
        data.mkdir(parents=True)
        artworks = data / "artworks.json"
        artworks.write_text(json.dumps({"artworks": [
            {"id": "painting", "title": "Portrait", "image": "assets/works/p.jpg",
             "collection": "Oil Paintings", "status": "active"},
            {"id": "drawing", "title": "Study", "image": "assets/works/d.jpg",
             "collection": "Drawings", "status": "active"}
        ]}))
        master = root / ".art-private" / "related" / "related-master.json"
        master.parent.mkdir(parents=True)
        old = {"version": 1, "references": [], "sets": [{
            "id": "existing-group", "title": "Existing drawing and painting",
            "members": [{"kind": "artwork", "id": "painting"},
                        {"kind": "artwork", "id": "drawing"}]}]}
        master.write_text(json.dumps(old))
        for module, attr_values in (
            (related, {"MASTER_PATH": master,
                       "PUBLIC_PATH": data / "related-public.json",
                       "PUBLIC_REFERENCES": art / "assets" / "related",
                       "ARTWORKS_PATH": artworks}),
            (studio, {"INDEX": root / ".art-private" / "studio" / "assets.json",
                      "PRIVATE_FILES": root / ".art-private" / "studio" / "files",
                      "PUBLIC_INDEX": data / "studio-related.json",
                      "PUBLIC_FILES": art / "assets" / "studio",
                      "ARTWORKS": artworks})
        ):
            for attribute, path in attr_values.items():
                mock = patch.object(module, attribute, path)
                mock.start()
                self.addCleanup(mock.stop)
        self.old_group = old["sets"][0]

    def make_asset(self, filename="underpainting.jpg", visibility="related"):
        return studio.upload_asset({
            "filename": filename, "title": "Underpainting",
            "visibility": visibility, "artworkIds": [],
            "fileDataUrl": "data:image/jpeg;base64," +
                           base64.b64encode(b"painting-process").decode("ascii")
        })

    def test_studio_asset_in_existing_relate_group_publishes_without_room_card(self):
        a = self.make_asset()
        master, group, duplicate = related.save_related_set(
            "", "Process and finished painting",
            [{"kind": "artwork", "id": "painting"},
             {"kind": "studio", "id": a["id"]}])
        self.assertIsNone(duplicate)
        self.assertEqual("studio", group["members"][1]["kind"])
        self.assertEqual(self.old_group["id"], master["sets"][0]["id"])
        self.assertEqual(self.old_group["members"][0]["id"],
                         master["sets"][0]["members"][0]["id"])
        public = related.build_public_related()
        new_group = next(g for g in public["sets"] if g["id"] == group["id"])
        self.assertEqual(["artwork", "studio"],
                         [m["kind"] for m in new_group["members"]])
        studio.build_public_studio()
        self.assertTrue((studio.PUBLIC_FILES / a["storedName"]).is_file())
        self.assertFalse(any(item["id"] == a["id"]
                             for item in json.loads(studio.ARTWORKS.read_text())["artworks"]))
        self.assertEqual(self.old_group["id"], related.load_master()["sets"][0]["id"])

    def test_private_asset_needs_explicit_publication_consent(self):
        a = self.make_asset(visibility="private")
        _, group, _ = related.save_related_set(
            "", "Private study",
            [{"kind": "artwork", "id": "painting"},
             {"kind": "studio", "id": a["id"]}])
        public = related.build_public_related()
        self.assertFalse(any(g["id"] == group["id"] for g in public["sets"]))
        self.assertEqual("private", studio.find_asset(a["id"])["visibility"])
        _, updated, _ = related.save_related_set(
            group["id"], "Public study",
            [{"kind": "artwork", "id": "painting"},
             {"kind": "studio", "id": a["id"]}],
            make_studio_public=True)
        self.assertEqual(group["id"], updated["id"])
        self.assertEqual("related", studio.find_asset(a["id"])["visibility"])
        self.assertTrue(any(g["id"] == group["id"]
                            for g in related.build_public_related()["sets"]))

    def test_invalid_studio_asset_never_overwrites_existing_groups(self):
        before = related.MASTER_PATH.read_bytes()
        with self.assertRaisesRegex(ValueError, "Unknown related members"):
            related.save_related_set(
                "", "No such study",
                [{"kind": "artwork", "id": "painting"},
                 {"kind": "studio", "id": "asset-nonexistent"}])
        self.assertEqual(before, related.MASTER_PATH.read_bytes())

    def test_unsupported_studio_format_cannot_be_published(self):
        a = self.make_asset("source.html", visibility="private")
        before = related.MASTER_PATH.read_bytes()
        with self.assertRaisesRegex(ValueError, "cannot be published"):
            related.save_related_set(
                "", "Invalid source",
                [{"kind": "artwork", "id": "painting"},
                 {"kind": "studio", "id": a["id"]}],
                make_studio_public=True)
        self.assertEqual(before, related.MASTER_PATH.read_bytes())
        self.assertEqual("private", studio.find_asset(a["id"])["visibility"])


if __name__ == "__main__":
    unittest.main()
