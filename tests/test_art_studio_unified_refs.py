"""Unified Studio views do not migrate or expose existing private references."""
from __future__ import annotations

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
import art_studio_library as library
import art_transfer as transfer


class StudioUnifiedReferencesTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        art = self.root / "art"
        data = art / "data"
        data.mkdir(parents=True)
        self.artworks = data / "artworks.json"
        self.artworks.write_text(json.dumps({"artworks": [
            {"id": "painting", "title": "Oil portrait",
             "collection": "Oil Paintings", "status": "active",
             "image": "assets/works/oil-paintings/portrait.jpg"}]}))
        self.master_path = self.root / ".art-private" / "related" / "related-master.json"
        self.master_path.parent.mkdir(parents=True)
        self.ref_folder = self.master_path.parent / "references"
        self.ref_folder.mkdir()
        self.ref_image = self.ref_folder / "ref-legacy.jpg"
        self.ref_image.write_bytes(b"\xff\xd8\xffprivate-original")
        self.master = {
            "version": 1,
            "references": [{
                "id": "ref-legacy", "title": "Old photograph",
                "notes": "Composition reference", "creator": "Photographer",
                "rights": "Private permission", "sourceUrl": "https://example.org/photo",
                "visibility": "private", "file": "ref-legacy.jpg",
                "originalFilename": "photograph.jpg", "createdAt": "2026-01-01"
            }],
            "sets": [{"id": "historic-group", "title": "Original group",
                      "members": [{"kind": "artwork", "id": "painting", "role": "related", "note": ""},
                                  {"kind": "reference", "id": "ref-legacy", "role": "source", "note": ""}]}],
        }
        self.master_path.write_text(json.dumps(self.master))
        index = self.root / ".art-private" / "studio" / "assets.json"
        paths = [
            (related, "MASTER_PATH", self.master_path),
            (related, "PRIVATE_REFERENCES", self.ref_folder),
            (related, "PUBLIC_PATH", data / "related-public.json"),
            (related, "PUBLIC_REFERENCES", art / "assets" / "related"),
            (related, "ARTWORKS_PATH", self.artworks),
            (studio, "INDEX", index),
            (studio, "PRIVATE_FILES", index.parent / "files"),
            (studio, "PUBLIC_INDEX", data / "studio-related.json"),
            (studio, "PUBLIC_FILES", art / "assets" / "studio"),
            (studio, "ARTWORKS", self.artworks),
        ]
        for module, attr, value in paths:
            p = patch.object(module, attr, value)
            p.start()
            self.addCleanup(p.stop)

    def upload(self, reference=False):
        return studio.upload_asset({
            "filename": "sketch.jpg", "title": "New study",
            "isReference": reference, "visibility": "private",
            "artworkIds": [],
            "fileDataUrl": "data:image/jpeg;base64," +
                base64.b64encode(b"\xff\xd8\xffnew-file").decode(),
        })

    def test_old_reference_appears_in_studio_with_original_file_unchanged(self):
        before_master = self.master_path.read_bytes()
        before_image = self.ref_image.read_bytes()
        items = library.all_items()
        self.assertEqual(1, len(items))
        self.assertEqual("reference", items[0]["kind"])
        self.assertTrue(items[0]["isReference"])
        self.assertTrue(items[0]["hasFile"])
        self.assertEqual("private", items[0]["visibility"])
        self.assertEqual("/api/reference-image/ref-legacy", items[0]["localUrl"])
        self.assertEqual(before_master, self.master_path.read_bytes())
        self.assertEqual(before_image, self.ref_image.read_bytes())
        self.assertFalse(studio.INDEX.exists())

    def test_mark_new_studio_image_reference_without_publication(self):
        asset = self.upload(reference=True)
        entry = next(x for x in library.all_items() if x["id"] == asset["id"])
        self.assertTrue(entry["isReference"])
        self.assertEqual("private", entry["visibility"])
        self.assertEqual([], related.build_public_related()["sets"])
        with self.assertRaisesRegex(ValueError, "References stay in Studio"):
            transfer.to_gallery(asset["id"], "Oil Paintings")
        self.assertEqual("private", studio.find_asset(asset["id"])["visibility"])

    def test_edit_legacy_reference_preserves_original_identity_and_group(self):
        old = related.load_master()
        result = library.update_legacy_reference({
            "id": "ref-legacy", "title": "Composition study",
            "note": "Revised description", "isReference": False,
        })
        self.assertEqual("ref-legacy", result["id"])
        self.assertFalse(result["isReference"])
        updated = related.load_master()
        self.assertEqual(old["sets"], updated["sets"])
        self.assertEqual("private", updated["references"][0]["visibility"])
        self.assertEqual("Photographer", updated["references"][0]["creator"])
        self.assertEqual("Private permission", updated["references"][0]["rights"])
        self.assertEqual(self.ref_image.read_bytes(), b"\xff\xd8\xffprivate-original")

    def test_private_reference_requires_explicit_gallery_relation_consent(self):
        original = self.master_path.read_bytes()
        public = related.build_public_related()
        self.assertEqual([], public["sets"])
        self.assertFalse((related.PUBLIC_REFERENCES / "ref-legacy.jpg").exists())
        self.assertEqual(original, self.master_path.read_bytes())
        result = related.save_related_set(
            "historic-group", "Portrait with reference",
            [{"kind": "artwork", "id": "painting"},
             {"kind": "reference", "id": "ref-legacy"}],
            make_studio_public=True)
        self.assertEqual("historic-group", result[1]["id"])
        self.assertEqual("public", related.load_master()["references"][0]["visibility"])
        public = related.build_public_related()
        self.assertEqual(["artwork", "reference"], [m["kind"] for m in public["sets"][0]["members"]])
        self.assertTrue((related.PUBLIC_REFERENCES / "ref-legacy.jpg").is_file())

    def test_reference_only_group_cannot_make_images_public(self):
        before = self.master_path.read_bytes()
        extra = self.upload(reference=True)
        with self.assertRaisesRegex(ValueError, "Gallery artwork"):
            related.save_related_set(
                "", "Private study group",
                [{"kind": "reference", "id": "ref-legacy"},
                 {"kind": "studio", "id": extra["id"]}],
                make_studio_public=True)
        self.assertEqual(before, self.master_path.read_bytes())
        self.assertEqual("private", studio.find_asset(extra["id"])["visibility"])

    def test_studio_reorder_mixes_legacy_and_new_without_loss(self):
        added = self.upload(reference=False)
        ids = [added["id"], "ref-legacy"]
        assert set(ids) == {x["id"] for x in library.all_items()}
        self.assertEqual(2, library.reorder_all(ids)["count"])
        entries = {x["id"]: x for x in library.all_items()}
        self.assertEqual(10, entries[added["id"]]["sortOrder"])
        self.assertEqual(20, entries["ref-legacy"]["sortOrder"])
        self.assertEqual("private", entries["ref-legacy"]["visibility"])
        self.assertEqual("historic-group", related.load_master()["sets"][0]["id"])
        self.assertEqual(b"\xff\xd8\xffprivate-original", self.ref_image.read_bytes())
        before_master = self.master_path.read_bytes()
        before_index = studio.INDEX.read_bytes()
        with self.assertRaisesRegex(ValueError, "changed"):
            library.reorder_all(["ref-legacy", "ref-legacy"])
        self.assertEqual(before_master, self.master_path.read_bytes())
        self.assertEqual(before_index, studio.INDEX.read_bytes())


if __name__ == "__main__":
    unittest.main()
