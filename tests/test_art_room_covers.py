"""Room cover selection is a single Gallery Edit action.

No private artwork, production curation or GitHub publication is modified.
"""
from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
import art_curator_server as server
import build_art_gallery_static as builder


class RoomCoverTests(unittest.TestCase):
    def setUp(self):
        self.old = {
            "id": "oil-old", "title": "Old oil painting", "collection": "Oil Paintings",
            "image": "assets/works/oil-paintings/old.jpg", "status": "active"
        }
        self.new = {
            "id": "oil-new", "title": "New oil painting", "collection": "Oil Paintings",
            "image": "assets/works/oil-paintings/new.jpg", "status": "active"
        }
        self.hero = {"id": "hero-a", "collection": "Oil Paintings",
                     "image": "assets/works/oil-paintings/hero.jpg"}
        self.curation = {
            "homepageHero": copy.deepcopy(self.hero),
            "collections": {
                "Oil Paintings": {"feature": server.record_selector(self.old)},
                "Watercolours": {"feature": {"id": "water-feature", "image": "water.jpg"}}
            }
        }

    def test_select_new_painting_changes_room_tile_and_room_lead(self):
        changed = server.apply_room_cover_edit(self.curation, self.new, "Oil Paintings", True)
        self.assertTrue(changed)
        feature = self.curation["collections"]["Oil Paintings"]["feature"]
        self.assertEqual("oil-new", feature["id"])
        self.assertEqual("assets/works/oil-paintings/new.jpg", feature["image"])
        collection = next(x for x in builder.COLLECTIONS if x["name"] == "Oil Paintings")
        chosen = builder.choose_feature([self.old, self.new], collection, self.curation)
        self.assertEqual("oil-new", chosen["id"])
        tile = builder.room_tile_html(collection, [self.old, self.new], self.curation)
        self.assertIn("new.jpg", tile)
        self.assertNotIn("old.jpg", tile)
        self.assertEqual(self.hero, self.curation["homepageHero"])

    def test_uncheck_current_cover_restores_auto_selection_without_disturbing_other_rooms(self):
        before_water = copy.deepcopy(self.curation["collections"]["Watercolours"])
        self.assertTrue(server.apply_room_cover_edit(self.curation, self.old, "Oil Paintings", False))
        self.assertNotIn("feature", self.curation["collections"]["Oil Paintings"])
        self.assertEqual(before_water, self.curation["collections"]["Watercolours"])
        self.assertEqual(self.hero, self.curation["homepageHero"])

    def test_unchecking_noncover_does_not_replace_existing_cover(self):
        before = copy.deepcopy(self.curation)
        self.assertFalse(server.apply_room_cover_edit(self.curation, self.new, "Oil Paintings", False))
        self.assertEqual(before, self.curation)

    def test_move_featured_work_to_another_room_updates_only_relevant_covers(self):
        moved = copy.deepcopy(self.old)
        moved["collection"] = "Experimental"
        before_water = copy.deepcopy(self.curation["collections"]["Watercolours"])
        self.assertTrue(server.apply_room_cover_edit(self.curation, moved, "Oil Paintings", True))
        self.assertNotIn("feature", self.curation["collections"]["Oil Paintings"])
        self.assertEqual("oil-old", self.curation["collections"]["Experimental"]["feature"]["id"])
        self.assertEqual(before_water, self.curation["collections"]["Watercolours"])
        self.assertEqual(self.hero, self.curation["homepageHero"])

    def test_existing_external_curated_cover_can_be_replaced_with_a_gallery_work(self):
        self.curation["collections"]["Oil Paintings"]["feature"] = {
            "id": "curated-external",
            "image": "https://qiquantum.wordpress.com/external.jpg",
            "title": "Old external cover",
        }
        server.apply_room_cover_edit(self.curation, self.new, "Oil Paintings", True)
        self.assertEqual("oil-new", self.curation["collections"]["Oil Paintings"]["feature"]["id"])


if __name__ == "__main__":
    unittest.main()
