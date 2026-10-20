"""Google Photos Picker integration tests. No live credentials/network required."""
from __future__ import annotations

import base64
import json
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import art_google_photos as photos
import art_studio_assets as studio


class GooglePhotosTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        private = root / ".art-private" / "google-photos"
        index = root / ".art-private" / "studio" / "assets.json"
        art = root / "art"
        (art / "data").mkdir(parents=True)
        artworks = art / "data" / "artworks.json"
        artworks.write_text(json.dumps({"artworks": [
            {"id": "drawing-id", "title": "Drawing", "image": "foo.jpg", "status": "active"},
            {"id": "painting-id", "title": "Painting", "image": "bar.jpg", "status": "active"},
        ]}), encoding="utf-8")
        original = art / "data" / "related-public.json"
        original.write_text(json.dumps({"sets": [{"id": "original", "members": [
            {"kind": "artwork", "id": "drawing-id"},
            {"kind": "artwork", "id": "painting-id"}
        ]}]}))
        self.legacy = original
        self.legacy_bytes = original.read_bytes()
        fixes = {
            studio: {"INDEX": index, "PRIVATE_FILES": index.parent / "files",
                     "PUBLIC_INDEX": art / "data" / "studio-related.json",
                     "PUBLIC_FILES": art / "assets" / "studio", "ARTWORKS": artworks},
            photos: {"PRIVATE": private, "CONFIG": private / "client.json",
                     "TOKEN": private / "token.json", "FLOW": private / "oauth-flow.json",
                     "PICK": private / "picker-session.json"},
        }
        for module, changes in fixes.items():
            for key, value in changes.items():
                mocked = patch.object(module, key, value)
                mocked.start()
                self.addCleanup(mocked.stop)

    def test_requires_google_cloud_config_and_does_not_expose_secret(self):
        status = photos.public_status()
        self.assertFalse(status["configured"])
        self.assertEqual("http://localhost:8000/api/google-photos/callback", status["redirectUri"])
        with self.assertRaises(ValueError):
            photos.oauth_start()
        photos.configure({
            "clientId": "example.apps.googleusercontent.com",
            "clientSecret": "not-a-real-secret",
        })
        url = photos.oauth_start()
        self.assertIn("photospicker.mediaitems.readonly", url)
        self.assertIn("code_challenge=", url)
        self.assertNotIn("not-a-real-secret", url)
        self.assertNotIn("clientSecret", str(photos.public_status()))

    def test_oauth_state_is_one_time_and_time_limited(self):
        photos.configure({"clientId": "test.apps.googleusercontent.com",
                          "clientSecret": "local-secret"})
        photos.oauth_start()
        with self.assertRaises(ValueError):
            photos.oauth_complete("fake-code", "wrong-state")
        self.assertFalse(photos.FLOW.exists())

    def test_media_download_enforces_google_hosts(self):
        self.assertEqual(
            "https://lh3.googleusercontent.com/p/abc=d",
            photos.google_media_url("https://lh3.googleusercontent.com/p/abc", False))
        self.assertEqual(
            "https://lh3.googleusercontent.com/p/abc=dv",
            photos.google_media_url("https://lh3.googleusercontent.com/p/abc", True))
        for url in ("http://lh3.googleusercontent.com/p/abc",
                    "https://evil.example.com/thing",
                    "https://lh3.googleusercontent.com.evil.test/p/abc"):
            with self.assertRaises(ValueError):
                photos.google_media_url(url, False)

    def test_import_linked_photo_keeps_published_relationships(self):
        photos.store_secret(photos.PICK, {"id": "picker-session", "created": time.time()})
        picked = [{"id": "photo-1", "createTime": "2026-10-20T12:00:00Z",
                   "mediaFile": {
                       "filename": "underpainting.jpg",
                       "mimeType": "image/jpeg",
                       "baseUrl": "https://lh3.googleusercontent.com/p/abcdef"
                   }}]
        def fake_api(path, method="GET", payload=None):
            if path.startswith("/sessions/"):
                return {"mediaItemsSet": True}
            if path.startswith("/mediaItems?"):
                return {"mediaItems": picked}
            return {}
        with patch.object(photos, "picker_call", side_effect=fake_api), \
             patch.object(photos, "download_media", return_value=b"test-image"):
            result = photos.import_picked({
                "ids": ["photo-1"], "artworkIds": ["drawing-id", "painting-id"],
                "visibility": "related",
            })
        self.assertEqual(1, len(result["imported"]))
        self.assertEqual([], result["failures"])
        projection = studio.build_public_studio()
        self.assertEqual(2, len(projection["sets"]))
        self.assertEqual(self.legacy_bytes, self.legacy.read_bytes())
        self.assertFalse(photos.PICK.exists())

    def test_refuses_other_artwork_ids_and_unknown_picker_ids(self):
        photos.store_secret(photos.PICK, {"id": "pick", "created": time.time()})
        with patch.object(photos, "picker_call", return_value={"mediaItemsSet": True}), \
             patch.object(photos, "selected_items", return_value=[]):
            with self.assertRaises(ValueError):
                photos.import_picked({
                    "ids": ["wrong"], "artworkIds": ["not-an-artwork"],
                    "visibility": "related",
                })
            result = photos.import_picked({
                "ids": ["wrong"], "artworkIds": ["drawing-id"],
                "visibility": "related",
            })
        self.assertEqual([], result["imported"])
        self.assertEqual(1, len(result["failures"]))
        self.assertEqual(self.legacy_bytes, self.legacy.read_bytes())


    # MAIN_GALLERY_PHOTOS_IMPORT_V1
    def test_selected_photo_becomes_normal_published_artwork(self):
        photos.store_secret(photos.PICK, {"id": "room-picker", "created": time.time()})
        picked = [{"id": "photo-a", "mediaFile": {
            "filename": "Portrait_Study.JPG", "mimeType": "image/jpeg",
            "baseUrl": "https://lh3.googleusercontent.com/p/portrait"}}]
        def fake_call(path, method="GET", payload=None):
            return {"mediaItemsSet": True} if path.startswith("/sessions/") else {"mediaItems": picked}
        captured = []
        def create_artwork(payload):
            captured.append(payload)
            return {"id": "new-artwork-1", "title": payload["title"], "image": "assets/works/new.jpg",
                    "collection": payload["collection"]}
        with patch.object(photos, "picker_call", side_effect=fake_call), \
             patch.object(photos, "download_media", return_value=b"fake-jpeg-image"):
            result = photos.import_picked_artworks({
                "ids": ["photo-a"], "title": "Portrait Study 2026",
                "collection": "Oil Paintings", "medium": "Oil on canvas",
                "subgroup": "Portrait", "text": "First study",
            }, create_artwork)
        self.assertEqual(1, len(result["imported"]))
        self.assertEqual("Google Photos import", result["imported"][0]["source"])
        self.assertEqual("Portrait Study 2026", captured[0]["title"])
        self.assertEqual("Oil Paintings", captured[0]["collection"])
        self.assertEqual("Oil on canvas", captured[0]["medium"])
        self.assertEqual("Portrait", captured[0]["subgroup"])
        self.assertEqual("First study", captured[0]["reading"])
        self.assertTrue(captured[0]["imageDataUrl"].startswith("data:image/jpeg;base64,"))
        self.assertEqual(self.legacy_bytes, self.legacy.read_bytes())
        self.assertFalse(photos.PICK.exists())

    def test_batch_titles_follow_filenames_and_feature_not_silently_assigned(self):
        photos.store_secret(photos.PICK, {"id": "room-picker", "created": time.time()})
        picked = [
            {"id": "a", "mediaFile": {"filename": "Venice_Night.png", "mimeType": "image/png",
                                     "baseUrl": "https://lh3.googleusercontent.com/p/a"}},
            {"id": "b", "mediaFile": {"filename": "Venice_Dawn.png", "mimeType": "image/png",
                                     "baseUrl": "https://lh3.googleusercontent.com/p/b"}},
        ]
        def fake_call(path, method="GET", payload=None):
            return {"mediaItemsSet": True} if path.startswith("/sessions/") else {"mediaItems": picked}
        created = []
        def make(payload):
            created.append(payload)
            return {"id": str(len(created)), "title": payload["title"]}
        with patch.object(photos, "picker_call", side_effect=fake_call), \
             patch.object(photos, "download_media", return_value=b"image"):
            with self.assertRaisesRegex(ValueError, "single image"):
                photos.import_picked_artworks({
                    "ids": ["a", "b"], "collection": "Drawings",
                    "makeHomepageHero": True,
                }, make)
            result = photos.import_picked_artworks({
                "ids": ["a", "b"], "title": "Must not replace filenames",
                "collection": "Drawings", "medium": "Pencil",
            }, make)
        self.assertEqual(["Venice Night", "Venice Dawn"], [x["title"] for x in created])
        self.assertEqual(2, len(result["imported"]))
        self.assertEqual([], result["failures"])
        self.assertEqual(self.legacy_bytes, self.legacy.read_bytes())

    def test_unsupported_photo_and_video_not_created_in_room(self):
        photos.store_secret(photos.PICK, {"id": "room-picker", "created": time.time()})
        picked = [
            {"id": "video", "mediaFile": {"filename": "process.mp4", "mimeType": "video/mp4"}},
            {"id": "heic", "mediaFile": {"filename": "study.heic", "mimeType": "image/heic"}},
        ]
        def fake_call(path, method="GET", payload=None):
            return {"mediaItemsSet": True} if path.startswith("/sessions/") else {"mediaItems": picked}
        with patch.object(photos, "picker_call", side_effect=fake_call):
            result = photos.import_picked_artworks({
                "ids": ["video", "heic"], "collection": "Experimental"}, 
                lambda _payload: self.fail("Must not create unsupported artwork"))
        self.assertEqual([], result["imported"])
        self.assertEqual(2, len(result["failures"]))
        self.assertEqual(self.legacy_bytes, self.legacy.read_bytes())

    def test_partial_room_import_keeps_success_and_reports_failures(self):
        photos.store_secret(photos.PICK, {"id": "room-picker", "created": time.time()})
        picked = [
            {"id": "one", "mediaFile": {"filename": "one.jpg", "mimeType": "image/jpeg",
                                      "baseUrl": "https://lh3.googleusercontent.com/p/a"}},
            {"id": "two", "mediaFile": {"filename": "two.jpg", "mimeType": "image/jpeg",
                                      "baseUrl": "https://lh3.googleusercontent.com/p/b"}},
        ]
        def fake_call(path, method="GET", payload=None):
            return {"mediaItemsSet": True} if path.startswith("/sessions/") else {"mediaItems": picked}
        def download(url):
            if "/p/b" in url:
                raise ValueError("Google photo download failed")
            return b"ok-image"
        with patch.object(photos, "picker_call", side_effect=fake_call), \
             patch.object(photos, "download_media", side_effect=download):
            result = photos.import_picked_artworks({
                "ids": ["one", "two"], "collection": "Watercolours"},
                lambda payload: {"id": "new-1", "title": payload["title"]})
        self.assertEqual(1, len(result["imported"]))
        self.assertEqual(1, len(result["failures"]))
        self.assertTrue(photos.PICK.exists())  # Retry unsuccessful media.
        self.assertEqual(self.legacy_bytes, self.legacy.read_bytes())



if __name__ == "__main__":
    unittest.main()
