"""Mutation tests of the evidence checker, not tests of a Noveliaa application."""
import copy
import contextlib
import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from check_evidence import InputError, check, main


def digest(value):
    return hashlib.sha256(value).hexdigest()


class EvidenceChecks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.after = self.root / "bundle.json"
        self.before = self.root / "before.json"
        self.oracle = self.root / "oracle.json"
        self.data = {
            "schema_version": 1, "dataset_kind": "synthetic",
            "app_revision": "synthetic-checker-fixture-v1", "author_id": "author-1",
            "behavior_disabled": False,
            **{key: [] for key in ("originals", "revisions", "proposals", "decisions",
                                  "assets", "editions", "feedback", "consents",
                                  "behavior", "save_receipts")}}

        def content(rid, filename, value):
            self.root.joinpath(filename).write_bytes(value)
            return {"id": rid, "universe_id": "u1", "path": filename,
                    "sha256": digest(value)}

        original = content("o1", "source.txt",
                           b"You said:\r\nA quiet doorway.\r\nChatGPT said:\r\nA tower.\r\n")
        original.update(origin="imported_chat", verification="mixed",
                        source_reference="synthetic fixture, not a real transcript")
        self.data["originals"] = [original]
        r1 = content("r1", "r1.txt", "A quiet doorway.\nहिंदी e\u0301 🙂\n".encode())
        r1.update(origin="mixed", document_id="d1", parent_ids=[],
                  source_original_ids=["o1"])
        r2 = content("r2", "r2.txt", "A quiet doorway, at dawn.\nहिंदी e\u0301 🙂\n".encode())
        r2.update(origin="mixed", document_id="d1", parent_ids=["r1"],
                  source_original_ids=["o1"], proposal_id="p1")
        self.data["revisions"] = [r1, r2]
        proposal = content("p1", "proposal.txt", self.root.joinpath("r2.txt").read_bytes())
        proposal.update(origin="ai", kind="proposal", client_id="fixture-client",
                        source_revision_ids=["r1"])
        self.data["proposals"] = [proposal]
        asset = content("a1", "asset.bin", b"SYNTHETIC MEDIA BYTES")
        self.data["assets"] = [asset]
        manifest = {"id": "e1", "universe_id": "u1",
                    "revision_refs": [{"id": "r2", "sha256": r2["sha256"]}],
                    "asset_refs": [{"id": "a1", "sha256": asset["sha256"]}],
                    "presentation": {"motion": False}}
        edition = content("e1", "edition.json", json.dumps(manifest).encode())
        self.data["editions"] = [edition]
        self.data["decisions"] = [
            {"id": "accept-1", "actor_id": "author-1", "kind": "accept_proposal",
             "target_id": "p1", "target_sha256": proposal["sha256"],
             "base_revision_id": "r1", "result_revision_id": "r2"},
            {"id": "canon-1", "actor_id": "author-1", "kind": "canon",
             "target_id": "r2", "target_sha256": r2["sha256"]},
            {"id": "asset-1", "actor_id": "author-1", "kind": "approve_asset",
             "target_id": "a1", "target_sha256": asset["sha256"]},
            {"id": "release-1", "actor_id": "author-1", "kind": "approve_edition",
             "target_id": "e1", "target_sha256": edition["sha256"]}]
        self.data["feedback"] = [
            {"id": "f1", "universe_id": "u1", "edition_id": "e1",
             "revision_id": "r2", "passage_id": "passage-1",
             "kind": "reader_response", "quote": "doorway"}]
        self.data["consents"] = [
            {"id": "c1", "session_id": "session-1", "edition_id": "e1",
             "purpose": "behavior", "granted_at_utc": "2026-10-23T10:00:00Z",
             "withdrawn_at_utc": "2026-10-23T10:30:00Z"}]
        self.data["behavior"] = [
            {"id": "b1", "session_id": "session-1", "edition_id": "e1",
             "consent_id": "c1", "kind": "pause", "at_utc": "2026-10-23T10:01:00Z",
             "received_at_utc": "2026-10-23T10:02:00Z"}]
        self.data["save_receipts"] = [
            {"id": "save-1", "revision_id": "r1", "level": "local"},
            {"id": "save-2", "revision_id": "r2", "level": "cloud"}]
        baseline = copy.deepcopy(self.data)
        for key in ("proposals", "decisions", "assets", "editions", "feedback",
                    "consents", "behavior"):
            baseline[key] = []
        baseline["revisions"] = [copy.deepcopy(r1)]
        baseline["save_receipts"] = [copy.deepcopy(self.data["save_receipts"][0])]
        baseline["behavior_disabled"] = True
        self.write(self.before, baseline)
        self.write(self.oracle, {"schema_version": 1,
                                "originals": {"o1": original["sha256"]},
                                "saved_revisions": {"r1": r1["sha256"],
                                                    "r2": r2["sha256"]}})

    @staticmethod
    def write(path, data):
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    def run_check(self):
        self.write(self.after, self.data)
        return check(self.after, self.oracle, self.before, allow_synthetic=True)

    def assert_fault(self, code):
        report = self.run_check()
        self.assertEqual("FAIL", report["status"])
        self.assertTrue(any(x.startswith(code + ":") for x in report["problems"]),
                        report["problems"])

    def test_valid_synthetic_projection(self):
        self.assertEqual("STRUCTURAL_EVIDENCE_VALID", self.run_check()["status"])

    def test_changed_original_even_with_recomputed_self_hash(self):
        raw = b"rewritten original"
        self.root.joinpath("source.txt").write_bytes(raw)
        self.data["originals"][0]["sha256"] = digest(raw)
        self.assert_fault("C01")

    def test_damaged_body_without_recomputed_hash(self):
        self.root.joinpath("r2.txt").write_bytes(b"broken")
        self.assert_fault("C01")

    def test_missing_expected_saved_revision(self):
        self.data["revisions"].pop()
        self.assert_fault("C03")

    def test_rewritten_history_metadata(self):
        self.data["revisions"][0]["origin"] = "author"
        self.assert_fault("C09")

    def test_cycle_and_cross_universe(self):
        self.data["revisions"][0]["parent_ids"] = ["r2"]
        self.assert_fault("C02")
        self.data["revisions"][0]["parent_ids"] = []
        self.data["revisions"][1]["universe_id"] = "u2"
        self.assert_fault("C02")

    def test_ai_proposal_source_mismatch(self):
        self.data["proposals"][0]["source_revision_ids"] = ["missing"]
        self.assert_fault("C04")

    def test_agent_decision_and_origin_laundering(self):
        self.data["decisions"][0]["actor_id"] = "agent"
        self.assert_fault("C05")
        self.data["decisions"][0]["actor_id"] = "author-1"
        self.data["revisions"][1]["origin"] = "author"
        self.assert_fault("C05")

    def test_unapproved_edition_and_asset(self):
        self.data["decisions"] = self.data["decisions"][:2]
        self.assert_fault("C06")

    def test_approval_digest_mismatch(self):
        self.data["decisions"][-1]["target_sha256"] = "0" * 64
        self.assert_fault("C05")

    def test_changed_existing_edition_even_if_new_hash_is_approved(self):
        self.write(self.before, copy.deepcopy(self.data))
        manifest_path = self.root / "edition.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["presentation"]["motion"] = True
        self.write(manifest_path, manifest)
        new_hash = digest(manifest_path.read_bytes())
        self.data["editions"][0]["sha256"] = new_hash
        self.data["decisions"][-1]["target_sha256"] = new_hash
        self.assert_fault("C09")

    def test_edition_revision_digest_mismatch(self):
        manifest_path = self.root / "edition.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["revision_refs"][0]["sha256"] = "0" * 64
        self.write(manifest_path, manifest)
        new_hash = digest(manifest_path.read_bytes())
        self.data["editions"][0]["sha256"] = new_hash
        self.data["decisions"][-1]["target_sha256"] = new_hash
        self.assert_fault("C06")

    def test_feedback_wrong_revision_or_missing_quote(self):
        self.data["feedback"][0]["revision_id"] = "r1"
        self.assert_fault("C07")
        self.data["feedback"][0]["revision_id"] = "r2"
        self.data["feedback"][0]["quote"] = "absent words"
        self.assert_fault("C07")

    def test_consent_boundaries_and_late_offline_upload(self):
        original = copy.deepcopy(self.data["behavior"][0])
        for field, value in (
            ("at_utc", "2026-10-23T09:59:59Z"),
            ("at_utc", "2026-10-23T10:30:00Z"),
            ("received_at_utc", "2026-10-23T10:30:01Z"),
            ("session_id", "someone-else"),
            ("kind", "bored")):
            with self.subTest(field=field, value=value):
                self.data["behavior"] = [copy.deepcopy(original)]
                self.data["behavior"][0][field] = value
                self.assert_fault("C08")

    def test_disabled_behavior(self):
        self.data["behavior_disabled"] = True
        self.assert_fault("C08")
        self.data["behavior"] = []
        self.assertEqual("STRUCTURAL_EVIDENCE_VALID", self.run_check()["status"])

    def test_restore_adds_revision_preserving_origin(self):
        restored = copy.deepcopy(self.data["revisions"][0])
        restored.update(id="r3", parent_ids=["r2"], restored_from="r1")
        self.data["revisions"].append(restored)
        self.assertEqual("STRUCTURAL_EVIDENCE_VALID", self.run_check()["status"])
        restored["origin"] = "author"
        self.assert_fault("C02")

    def test_empty_and_duplicate_evidence_blocked(self):
        self.data["proposals"] = []
        with self.assertRaises(InputError):
            self.run_check()
        self.data["originals"].append(copy.deepcopy(self.data["originals"][0]))
        with self.assertRaises(InputError):
            self.run_check()

    def test_path_escape_and_symlink_blocked(self):
        self.data["originals"][0]["path"] = "../outside"
        with self.assertRaises(InputError):
            self.run_check()
        self.root.joinpath("escape").symlink_to("/etc/hosts")
        self.data["originals"][0]["path"] = "escape"
        with self.assertRaises(InputError):
            self.run_check()

    def test_naive_timestamp_blocked(self):
        self.data["behavior"][0]["at_utc"] = "2026-10-23T10:01:00"
        with self.assertRaises(InputError):
            self.run_check()

    def test_synthetic_not_accepted_as_runtime(self):
        self.write(self.after, self.data)
        with self.assertRaises(InputError):
            check(self.after, self.oracle, self.before)

    def test_missing_json_and_cli_status(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(2, main([str(self.after), "--oracle", str(self.oracle),
                                     "--before", str(self.before)]))

    def test_cli_valid_and_failed_projection_exit_status(self):
        args = [str(self.after), "--oracle", str(self.oracle),
                "--before", str(self.before), "--allow-synthetic"]
        self.write(self.after, self.data)
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(0, main(args))
            self.root.joinpath("source.txt").write_bytes(b"damaged")
            self.assertEqual(1, main(args))


if __name__ == "__main__":
    unittest.main()
