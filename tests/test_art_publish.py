"""Local ARTS publishing guards. Tests use a disposable Git repository only."""
from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import art_publish as publisher


class PublishWorkflowTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.git("init", "-b", "master")
        self.git("config", "user.name", "ARTS Test")
        self.git("config", "user.email", "arts@example.invalid")
        self.git("remote", "add", "origin",
                 "https://github.com/salmonofdoubt/salmonofdoubt.github.io")
        self.write(".gitignore", ".art-private/\n")
        self.write("art/data/artworks.json", json.dumps({"artworks": [
            {"id": "old", "title": "Original", "collection": "Drawings"}
        ]}))
        self.write("art/index.html", "<h1>Old gallery</h1>")
        self.git("add", "-A")
        self.git("commit", "-m", "Initial test gallery")
        self.base = self.git("rev-parse", "HEAD").strip()
        self.git("update-ref", "refs/remotes/origin/master", self.base)
        patched = patch.object(publisher, "ROOT", self.root)
        patched.start()
        self.addCleanup(patched.stop)

    def git(self, *args):
        result = subprocess.run(["git", "-C", str(self.root), *args],
                                capture_output=True, text=True)
        if result.returncode:
            raise AssertionError(result.stderr)
        return result.stdout

    def write(self, path, value):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(value, encoding="utf-8")

    def modify(self):
        self.write("art/data/artworks.json", json.dumps({"artworks": [
            {"id": "old", "title": "Original", "collection": "Drawings"},
            {"id": "new", "title": "Portrait study", "collection": "Oil Paintings"},
        ]}))
        self.write("art/assets/works/oil-paintings/new.jpg", "image-test")
        self.write("docs/unrelated.txt", "Never published from ARTS manager")
        self.write(".art-private/studio/assets.json", '{"private":true}')

    def test_review_includes_public_records_and_excludes_unrelated(self):
        self.modify()
        report = publisher.review()
        names = {f["path"] for f in report["files"]}
        self.assertEqual({"art/data/artworks.json", "art/assets/works/oil-paintings/new.jpg"}, names)
        self.assertTrue(report["ready"])
        self.assertEqual(["Portrait study"],
                         [item["title"] for item in
                          next(f for f in report["files"] if f["path"].endswith("artworks.json"))
                          ["summary"]["added"]])
        self.assertIn("docs/unrelated.txt", {f["path"] for f in report["excluded"]})
        self.assertNotIn(".art-private/studio/assets.json",
                         json.dumps(report))
        self.assertTrue(publisher.allowed_path("art/assets/studio/asset-" + "a"*32 + ".png"))
        self.assertFalse(publisher.allowed_path(".art-private/studio/files/asset-thing.png"))
        self.assertFalse(publisher.allowed_path("demos/wq/data/latest.json"))

    def test_commit_only_reviewed_public_files(self):
        self.modify()
        review = publisher.review()
        result = publisher.commit(review["token"], "ARTS: reviewed import")
        self.assertTrue(result["ok"])
        committed = set(self.git("show", "--pretty=format:", "--name-only", "HEAD").splitlines())
        self.assertEqual({"art/data/artworks.json", "art/assets/works/oil-paintings/new.jpg"}, committed)
        self.assertIn("docs/unrelated.txt", self.git("status", "--short"))
        self.assertNotIn(".art-private", self.git("ls-tree", "-r", "--name-only", "HEAD"))
        self.assertNotIn("docs/unrelated.txt", committed)

    def test_changed_after_review_requires_new_approval(self):
        self.modify()
        report = publisher.review()
        self.write("art/assets/works/oil-paintings/new.jpg", "modified after review")
        with self.assertRaisesRegex(publisher.PublishError, "outdated"):
            publisher.commit(report["token"])
        self.assertEqual(self.base, self.git("rev-parse", "HEAD").strip())

    def test_other_staged_changes_block_commit(self):
        self.modify()
        self.git("add", "docs/unrelated.txt")
        report = publisher.review()
        self.assertFalse(report["ready"])
        with self.assertRaisesRegex(publisher.PublishError, "Other changes are staged"):
            publisher.commit(report["token"])
        self.assertEqual(self.base, self.git("rev-parse", "HEAD").strip())

    def test_publish_review_rejects_uncommitted_gallery(self):
        self.modify()
        with self.assertRaisesRegex(publisher.PublishError, "not committed"):
            publisher.publish_review()

    def test_publish_requires_exact_confirmation_and_latest_review(self):
        self.modify()
        report = publisher.review()
        publisher.commit(report["token"])
        with patch.object(publisher, "origin_sha", return_value=self.base):
            checked = publisher.publish_review()
            self.assertEqual(1, checked["ahead"])
            self.assertIn("art/data/artworks.json", checked["files"])
            with self.assertRaisesRegex(publisher.PublishError, "Type PUBLISH"):
                publisher.publish(checked["token"], "yes")
            with self.assertRaisesRegex(publisher.PublishError, "outdated"):
                publisher.publish("incorrect-token", "PUBLISH")

    def test_unrelated_outgoing_commit_blocks_publication(self):
        self.write("docs/unrelated.txt", "other project")
        self.git("add", "docs/unrelated.txt")
        self.git("commit", "-m", "Other project")
        with patch.object(publisher, "origin_sha", return_value=self.base):
            with self.assertRaisesRegex(publisher.PublishError, "outside the gallery"):
                publisher.publish_review()

    def test_no_unintentional_push_is_run_during_commit(self):
        self.modify()
        with patch.object(publisher, "run_git", wraps=publisher.run_git) as git:
            publisher.commit(publisher.review()["token"])
            self.assertFalse(any(call.args and call.args[0] == "push" for call in git.call_args_list))


if __name__ == "__main__":
    unittest.main()
