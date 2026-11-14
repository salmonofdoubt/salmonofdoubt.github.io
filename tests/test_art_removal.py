"""Exact matches and lossless, local-only Trash operations."""
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
import art_removal as removal


class ArtRemovalTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        art = root / "art"
        data = art / "data"
        data.mkdir(parents=True)
        self.art = art
        self.artworks = data / "artworks.json"
        self.curation = data / "art-curation.json"
        self.master_path = root / ".art-private" / "related" / "related-master.json"
        self.master_path.parent.mkdir(parents=True)
        self.ref_folder = self.master_path.parent / "references"
        self.ref_folder.mkdir()
        self.ref_file = self.ref_folder / "ref-old.jpg"
        self.ref_file.write_bytes(b"\xff\xd8\xffidentical-original")
        self.asset_index = root / ".art-private" / "studio" / "assets.json"
        self.asset_folder = self.asset_index.parent / "files"
        self.works = art / "assets" / "works" / "oil-paintings" / "A.jpg"
        self.works.parent.mkdir(parents=True)
        self.works.write_bytes(b"\xff\xd8\xffidentical-original")
        records = [
            {"id": "gallery-a", "title": "Original painting",
             "image": "assets/works/oil-paintings/A.jpg",
             "thumb": "assets/works/oil-paintings/A.jpg",
             "collection": "Oil Paintings", "status": "active"},
            {"id": "gallery-remote-a", "title": "Remote study",
             "image": "https://qiquantum.wordpress.com/uploads/portrait.jpg",
             "collection": "Drawings", "status": "active"},
            {"id": "gallery-remote-b", "title": "Remote copy",
             "image": "https://qiquantum.wordpress.com/uploads/portrait.jpg?raw=1",
             "collection": "Experimental", "status": "active"},
            {"id": "gallery-other", "title": "Different original",
             "image": "https://qiquantum.wordpress.com/uploads/not-identical.jpg",
             "collection": "Drawings", "status": "active"},
        ]
        self.artworks.write_text(json.dumps({"artworks": records}))
        self.curation.write_text(json.dumps({
            "homepageHero": {"id": "gallery-a", "image": records[0]["image"]},
            "collections": {"Oil Paintings":
                            {"feature": {"id": "gallery-a", "image": records[0]["image"]}}}
        }))
        master = {
            "version": 1,
            "references": [{
                "id": "ref-old", "title": "Reference original",
                "visibility": "private", "file": "ref-old.jpg",
                "originalFilename": "old.jpg", "notes": "Study",
                "isReference": True,
                "sourceUrl": "https://example.com/rights",
            }],
            "sets": [{
                "id": "original-set", "title": "References",
                "members": [
                    {"kind": "artwork", "id": "gallery-a", "role": "related", "note": ""},
                    {"kind": "reference", "id": "ref-old", "role": "source", "note": ""},
                ],
            }],
        }
        self.master_path.write_text(json.dumps(master))
        replacement = [
            (transfer, "ROOT", root), (transfer, "ART", art),
            (transfer, "ARTWORKS", self.artworks), (transfer, "CURATION", self.curation),
            (related, "MASTER_PATH", self.master_path),
            (related, "PRIVATE_REFERENCES", self.ref_folder),
            (related, "PUBLIC_PATH", data / "related-public.json"),
            (related, "PUBLIC_REFERENCES", art / "assets" / "related"),
            (related, "ARTWORKS_PATH", self.artworks),
            (studio, "ARTWORKS", self.artworks),
            (studio, "INDEX", self.asset_index),
            (studio, "PRIVATE_FILES", self.asset_folder),
            (studio, "PUBLIC_FILES", art / "assets" / "studio"),
            (studio, "PUBLIC_INDEX", data / "studio-related.json"),
            (removal, "TRASH_DIR", root / ".art-private" / "trash"),
            (removal, "TRASH_INDEX", root / ".art-private" / "trash" / "records.json"),
            (removal, "TRASH_FILES", root / ".art-private" / "trash" / "files"),
        ]
        for module, attr, value in replacement:
            patcher = patch.object(module, attr, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def art_ids(self):
        return [a["id"] for a in json.loads(self.artworks.read_text())["artworks"]]

    def group_members(self):
        return related.load_master()["sets"][0]["members"]

    def studio_upload(self, name="Sketch", data=b"\xff\xd8\xffidentical-original"):
        return studio.upload_asset({
            "filename": "sketch.jpg", "title": name,
            "fileDataUrl": "data:image/jpeg;base64," +
                           base64.b64encode(data).decode("ascii"),
            "visibility": "private", "artworkIds": ["gallery-a"],
        })

    def test_exact_duplication_across_gallery_studio_ref_and_remote(self):
        study = self.studio_upload()
        groups = removal.exact_duplicates()
        sets = [set((m["kind"], m["id"]) for m in g["items"]) for g in groups]
        self.assertTrue(any({("gallery", "gallery-a"),
                             ("studio", study["id"]),
                             ("reference", "ref-old")} <= pair for pair in sets))
        self.assertTrue(any({("gallery", "gallery-remote-a"),
                             ("gallery", "gallery-remote-b")} <= pair for pair in sets))
        self.assertFalse(any(("gallery", "gallery-other") in g for g in sets))
        self.assertTrue(all(g["match"] in {"Identical image files", "Same original image URL"} for g in groups))

    def test_remove_gallery_archives_image_and_restores_relationships_curation(self):
        before = self.works.read_bytes()
        study = self.studio_upload()
        removed = removal.remove_item("gallery", "gallery-a")
        self.assertIn("gallery-a", removed["removed"]["id"])
        self.assertEqual(1, removed["affectedGroups"])
        self.assertFalse(self.works.exists())
        self.assertNotIn("gallery-a", self.art_ids())
        self.assertEqual([], self.group_members()[:1]) if not self.group_members() else self.assertEqual("reference", self.group_members()[0]["kind"])
        self.assertEqual({}, json.loads(self.curation.read_text())["homepageHero"])
        self.assertEqual([], studio.find_asset(study["id"])["artworkIds"])
        self.assertEqual(1, len(removal.recent_removed()))
        restored = removal.restore_item(removed["trashId"])
        self.assertEqual("gallery-a", restored["id"])
        self.assertEqual(before, self.works.read_bytes())
        self.assertEqual("gallery-a", self.group_members()[0]["id"])
        self.assertEqual("gallery-a", json.loads(self.curation.read_text())["homepageHero"]["id"])
        self.assertEqual(["gallery-a"], studio.find_asset(study["id"])["artworkIds"])
        self.assertEqual([], removal.recent_removed())

    def test_remove_legacy_reference_preserves_file_in_trash_and_group(self):
        original = self.ref_file.read_bytes()
        removed = removal.remove_item("reference", "ref-old")
        self.assertFalse(self.ref_file.exists())
        self.assertEqual([], related.load_master()["references"])
        self.assertEqual(["gallery-a"], [x["id"] for x in self.group_members()])
        path = removal.TRASH_FILES / (removed["trashId"] + ".jpg")
        self.assertEqual(original, path.read_bytes())
        removal.restore_item(removed["trashId"])
        self.assertEqual(original, self.ref_file.read_bytes())
        self.assertEqual(["gallery-a", "ref-old"], [x["id"] for x in self.group_members()])

    def test_remove_studio_asset_does_not_remove_other_gallery_work(self):
        asset = self.studio_upload()
        removed = removal.remove_item("studio", asset["id"])
        self.assertIsNone(studio.find_asset(asset["id"]))
        self.assertEqual("gallery-a", self.art_ids()[0])
        self.assertFalse(studio.PRIVATE_FILES.joinpath(asset["storedName"]).exists())
        removal.restore_item(removed["trashId"])
        self.assertIsNotNone(studio.find_asset(asset["id"]))
        self.assertTrue(studio.PRIVATE_FILES.joinpath(asset["storedName"]).exists())

    def test_removing_remote_gallery_never_claims_to_delete_host(self):
        removed = removal.remove_item("gallery", "gallery-remote-a")
        self.assertNotIn("gallery-remote-a", self.art_ids())
        self.assertIn("gallery-remote-b", self.art_ids())
        self.assertTrue(any("external website" in w for w in removed["warnings"]))
        removal.restore_item(removed["trashId"])
        self.assertIn("gallery-remote-a", self.art_ids())

    def test_shared_managed_file_remains_until_final_galley_record_is_removed(self):
        existing = json.loads(self.artworks.read_text())
        other = existing["artworks"][-1]
        other["image"] = existing["artworks"][0]["image"]
        existing["artworks"][-1] = other
        self.artworks.write_text(json.dumps(existing))
        first = removal.remove_item("gallery", "gallery-a")
        self.assertTrue(self.works.exists())
        second = removal.remove_item("gallery", "gallery-other")
        self.assertFalse(self.works.exists())
        removal.restore_item(first["trashId"])
        self.assertTrue(self.works.exists())
        removal.restore_item(second["trashId"])
        self.assertTrue(self.works.exists())

    def test_unrecognized_item_never_mutates_archive(self):
        before_gallery = self.artworks.read_bytes()
        before_master = self.master_path.read_bytes()
        for kind, ident in [("gallery", "not-found"), ("reference", "not-found"),
                            ("untrusted", "gallery-a")]:
            with self.assertRaises((KeyError, ValueError)):
                removal.remove_item(kind, ident)
        self.assertEqual(before_gallery, self.artworks.read_bytes())
        self.assertEqual(before_master, self.master_path.read_bytes())
        self.assertFalse(removal.TRASH_INDEX.exists())

    def test_undo_refuses_when_another_record_uses_same_id(self):
        removed = removal.remove_item("reference", "ref-old")
        loaded = related.load_master()
        loaded["references"].append({"id": "ref-old", "title": "Replacement"})
        related.save_master(loaded)
        with self.assertRaisesRegex(ValueError, "already exists"):
            removal.restore_item(removed["trashId"])
        self.assertEqual(1, len(removal.recent_removed()))


if __name__ == "__main__":
    unittest.main()
