import json
import unittest
import test_check_evidence as fixtures
from check_evidence import InputError, check


class WritingProfileChecks(unittest.TestCase):
    setUp = fixtures.EvidenceChecks.setUp
    write = staticmethod(fixtures.EvidenceChecks.write)
    def writing_bundle(self):
        data = json.loads(self.before.read_text(encoding="utf-8"))
        self.write(self.after, data)
        oracle = json.loads(self.oracle.read_text(encoding="utf-8"))
        oracle["saved_revisions"].pop("r2")
        self.write(self.oracle, oracle)
        return data

    def test_writing_profile_without_fabricated_later_phases(self):
        self.writing_bundle()
        result = check(self.after, self.oracle, self.before, True, "writing")
        self.assertEqual("STRUCTURAL_EVIDENCE_VALID", result["status"])
        self.assertEqual("writing", result["profile"])

    def test_writing_profile_does_not_weaken_default_full_gate(self):
        self.writing_bundle()
        with self.assertRaises(InputError):
            check(self.after, self.oracle, self.before, True)

    def test_writing_profile_forbids_later_phase_records(self):
        with self.assertRaises(InputError):
            check(self.after, self.oracle, self.before, True, "writing")

    def test_writing_profile_still_detects_missing_saved_text(self):
        self.writing_bundle()
        self.root.joinpath("r1.txt").write_text("Changed after acknowledgement", encoding="utf-8")
        result = check(self.after, self.oracle, self.before, True, "writing")
        self.assertEqual("FAIL", result["status"])
