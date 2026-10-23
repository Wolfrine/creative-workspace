#!/usr/bin/env python3
"""Read-only checks of supplied Noveliaa evidence; never a release verdict."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

TABLES = ("originals", "revisions", "proposals", "decisions", "assets",
          "editions", "feedback", "consents", "behavior", "save_receipts")
IMMUTABLE = ("originals", "revisions", "proposals", "decisions", "assets", "editions")
ORIGINS = {"author", "recovered_original", "remembered_reconstruction",
           "imported_chat", "ai", "mixed", "unknown"}
HEX = re.compile(r"[0-9a-f]{64}")
MAX_FILE = 64 * 1024 * 1024


class InputError(ValueError):
    """Evidence is missing, malformed or not eligible for the requested run."""


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise InputError("duplicate JSON key")
        result[key] = value
    return result


def load_json(path):
    path = Path(path)
    try:
        if path.stat().st_size > MAX_FILE:
            raise InputError("evidence file exceeds 64 MiB checker limit")
        return json.loads(path.read_text(encoding="utf-8"),
                          object_pairs_hook=unique_object,
                          parse_constant=lambda _: (_ for _ in ()).throw(
                              InputError("non-finite JSON number")))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise InputError(f"cannot read JSON evidence: {type(exc).__name__}") from exc


def require(value, message):
    if not value:
        raise InputError(message)


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def fields(row, *names):
    for name in names:
        require(nonempty(row.get(name)), f"missing string field: {name}")


def ids(value, label, minimum=0):
    require(isinstance(value, list), f"{label} must be a list")
    require(all(nonempty(x) for x in value), f"{label} contains invalid ID")
    require(len(value) >= minimum and len(value) == len(set(value)),
            f"{label} is empty or contains duplicates")
    return value


def snapshot(path):
    body = load_json(path)
    require(isinstance(body, dict) and body.get("schema_version") == 1,
            "unsupported or absent bundle schema_version")
    fields(body, "author_id", "app_revision", "dataset_kind")
    require(body["dataset_kind"] in {"synthetic", "runtime"}, "invalid dataset kind")
    require(type(body.get("behavior_disabled")) is bool, "behavior_disabled required")
    indexed = {}
    for table in TABLES:
        rows = body.get(table)
        require(isinstance(rows, list), f"missing array: {table}")
        indexed[table] = {}
        for row in rows:
            require(isinstance(row, dict), f"invalid record in {table}")
            fields(row, "id")
            require(row["id"] not in indexed[table], f"duplicate ID in {table}")
            indexed[table][row["id"]] = row
    return body, indexed


def file_bytes(root, relative):
    require(nonempty(relative), "missing relative evidence path")
    rel = Path(relative)
    require(not rel.is_absolute() and ".." not in rel.parts,
            "evidence path traversal is forbidden")
    target = (root / rel).resolve()
    require(target.is_relative_to(root.resolve()), "evidence symlink escapes root")
    try:
        require(target.is_file(), "referenced evidence file is missing")
        require(target.stat().st_size <= MAX_FILE, "evidence file exceeds checker limit")
        return target.read_bytes()
    except OSError as exc:
        raise InputError("cannot read referenced evidence file") from exc


def stamp(value):
    require(nonempty(value), "missing UTC timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise InputError("malformed timestamp") from exc
    require(parsed.tzinfo is not None and parsed.utcoffset().total_seconds() == 0,
            "timestamp must explicitly be UTC")
    return parsed.astimezone(timezone.utc)


def check(bundle_path, oracle_path, before_path, allow_synthetic=False, profile="full"):
    bundle_path = Path(bundle_path)
    meta, tables = snapshot(bundle_path)
    before_meta, before = snapshot(before_path)
    require(meta["author_id"] == before_meta["author_id"], "before/after author mismatch")
    require(meta["dataset_kind"] == before_meta["dataset_kind"], "before/after kind mismatch")
    require(allow_synthetic or meta["dataset_kind"] == "runtime",
            "synthetic evidence needs --allow-synthetic; product acceptance is not tested")
    require(profile in {"full", "writing"}, "unknown evidence profile")
    required = (("originals", "revisions", "save_receipts") if profile == "writing"
                else ("originals", "revisions", "proposals", "decisions",
                      "editions", "feedback", "save_receipts"))
    if profile == "writing":
        require(meta["behavior_disabled"], "writing profile requires behavior disabled")
        for table in ("proposals", "decisions", "assets", "editions", "feedback", "consents", "behavior"):
            require(not tables[table], f"writing profile contains later-phase data: {table}")
    for table in required:
        require(tables[table], f"incomplete after profile: {table} has no evidence")
    oracle = load_json(oracle_path)
    require(isinstance(oracle, dict) and oracle.get("schema_version") == 1,
            "unsupported oracle schema")
    for key in ("originals", "saved_revisions"):
        require(isinstance(oracle.get(key), dict) and oracle[key], f"missing oracle: {key}")
        require(all(nonempty(k) and isinstance(v, str) and HEX.fullmatch(v)
                    for k, v in oracle[key].items()), f"invalid {key} oracle")

    problems = []

    def expect(condition, code, message):
        if not condition:
            problems.append(f"{code}: {message}")

    # Hash actual bytes, not only the export's own manifest.
    payloads = {}
    for table in ("originals", "revisions", "proposals", "assets", "editions"):
        payloads[table] = {}
        for rid, row in tables[table].items():
            fields(row, "universe_id", "path", "sha256")
            require(HEX.fullmatch(row["sha256"]), "invalid SHA-256")
            data = file_bytes(bundle_path.parent, row["path"])
            payloads[table][rid] = data
            expect(hashlib.sha256(data).hexdigest() == row["sha256"],
                   "C01", f"{table}/{rid} bytes disagree with hash")
    originals, revisions = tables["originals"], tables["revisions"]
    for rid, row in originals.items():
        fields(row, "source_reference", "origin", "verification")
        require(row["origin"] in ORIGINS, "unknown original origin label")
        require(row["verification"] in {"verified", "unverified", "mixed"},
                "unknown verification label")
        require(rid in oracle["originals"], "original absent from independent oracle")
        expect(row["sha256"] == oracle["originals"][rid], "C01", "original changed")
    expect(set(oracle["originals"]) <= set(originals), "C01", "original missing")
    for rid, digest in oracle["saved_revisions"].items():
        expect(rid in revisions and revisions[rid].get("sha256") == digest,
               "C03", "acknowledged expected text is missing or changed")

    def same(left, right):
        return left.get("universe_id") == right.get("universe_id")

    texts = {}
    for rid, row in revisions.items():
        fields(row, "document_id", "origin")
        require(row["origin"] in ORIGINS, "unknown revision origin")
        try:
            texts[rid] = payloads["revisions"][rid].decode("utf-8")
        except UnicodeError as exc:
            raise InputError("revision text projection must be UTF-8") from exc
        parents = ids(row.get("parent_ids"), "parent_ids")
        for parent_id in parents:
            parent = revisions.get(parent_id, {})
            expect(bool(parent) and same(row, parent)
                   and row["document_id"] == parent.get("document_id"),
                   "C02", "dangling/cross-document/cross-universe parent")
        for original_id in ids(row.get("source_original_ids"), "source_original_ids"):
            expect(original_id in originals and same(row, originals[original_id]),
                   "C02", "invalid original reference")
        if row.get("restored_from"):
            restored = revisions.get(row["restored_from"], {})
            expect(bool(restored) and same(row, restored)
                   and row["document_id"] == restored.get("document_id")
                   and row["sha256"] == restored.get("sha256")
                   and row["origin"] == restored.get("origin"),
                   "C02", "restore changed source identity, text or origin")
    # Topological elimination avoids recursion depth dependence.
    pending = set(revisions)
    completed = set()
    while pending:
        ready = {rid for rid in pending if set(revisions[rid]["parent_ids"]) <= completed}
        if not ready:
            expect(False, "C02", "cyclic or dangling revision graph")
            break
        pending -= ready
        completed |= ready

    for receipt in tables["save_receipts"].values():
        fields(receipt, "revision_id", "level")
        require(receipt["level"] in {"local", "cloud"}, "invalid save level")
        expect(receipt["revision_id"] in revisions
               and receipt["revision_id"] in oracle["saved_revisions"],
               "C03", "receipt has no independent saved-text oracle")

    proposals = tables["proposals"]
    for row in proposals.values():
        fields(row, "client_id")
        expect(row.get("origin") == "ai" and row.get("kind") == "proposal",
               "C04", "AI proposal mislabeled")
        for source_id in ids(row.get("source_revision_ids"), "source_revision_ids", 1):
            expect(source_id in revisions and same(row, revisions[source_id]),
                   "C04", "proposal source missing or wrong universe")

    approved_assets, approved_editions, accepted = set(), set(), set()
    target_tables = {"accept_proposal": "proposals", "canon": "revisions",
                     "approve_asset": "assets", "approve_edition": "editions"}
    for row in tables["decisions"].values():
        fields(row, "actor_id", "kind", "target_id", "target_sha256")
        require(row["kind"] in target_tables, "unknown decision kind")
        expect(row["actor_id"] == meta["author_id"], "C05", "non-author decision")
        target = tables[target_tables[row["kind"]]].get(row["target_id"], {})
        expect(bool(target) and row["target_sha256"] == target.get("sha256"),
               "C05", "approval target missing or hash mismatch")
        if row["kind"] == "approve_asset":
            approved_assets.add((row["target_id"], row["target_sha256"]))
        if row["kind"] == "approve_edition":
            approved_editions.add((row["target_id"], row["target_sha256"]))
        if row["kind"] == "accept_proposal":
            fields(row, "base_revision_id", "result_revision_id")
            result = revisions.get(row["result_revision_id"], {})
            base = row["base_revision_id"]
            expect(bool(result) and bool(target) and same(result, target)
                   and result.get("origin") in {"ai", "mixed"}
                   and result.get("proposal_id") == row["target_id"]
                   and base in target.get("source_revision_ids", [])
                   and base in result.get("parent_ids", []),
                   "C05", "accepted proposal lacks source-linked AI-origin result")
            accepted.add((row["target_id"], row["result_revision_id"]))
    for rid, row in revisions.items():
        if row.get("proposal_id"):
            expect((row["proposal_id"], rid) in accepted, "C05",
                   "proposal-derived revision has no acceptance decision")

    edition_revisions = {}
    for eid, row in tables["editions"].items():
        manifest = load_json(bundle_path.parent / row["path"])
        require(isinstance(manifest, dict), "edition manifest must be an object")
        expect(manifest.get("id") == eid and same(manifest, row),
               "C06", "edition identity mismatch")
        expect((eid, row["sha256"]) in approved_editions,
               "C06", "edition is not approved by exact digest")
        edition_revisions[eid] = set()
        for key, table in (("revision_refs", "revisions"), ("asset_refs", "assets")):
            refs = manifest.get(key)
            require(isinstance(refs, list) and (bool(refs) or key == "asset_refs"),
                    "missing edition references")
            seen = set()
            for ref in refs:
                require(isinstance(ref, dict), "invalid edition reference")
                fields(ref, "id", "sha256")
                expect(ref["id"] not in seen, "C06", "duplicate edition reference")
                seen.add(ref["id"])
                target = tables[table].get(ref["id"], {})
                expect(bool(target) and same(row, target)
                       and ref["sha256"] == target.get("sha256"),
                       "C06", "edition reference missing, changed or wrong universe")
                if table == "assets":
                    expect((ref["id"], ref["sha256"]) in approved_assets,
                           "C06", "unapproved edition asset")
                else:
                    edition_revisions[eid].add(ref["id"])

    for row in tables["feedback"].values():
        fields(row, "universe_id", "edition_id", "revision_id", "passage_id", "quote")
        expect(row.get("kind") in {"reader_response", "author_observation"},
               "C07", "feedback/observation origin not distinguished")
        edition = tables["editions"].get(row["edition_id"], {})
        expect(bool(edition) and same(row, edition)
               and row["revision_id"] in edition_revisions.get(row["edition_id"], set())
               and row["quote"] in texts.get(row["revision_id"], ""),
               "C07", "feedback references wrong edition/revision or absent quote")

    if meta["behavior_disabled"]:
        expect(not tables["behavior"], "C08", "behavior exists while disabled")
    else:
        require(tables["consents"] and tables["behavior"], "consent coverage is empty")
    for row in tables["behavior"].values():
        fields(row, "session_id", "edition_id", "consent_id", "kind")
        expect(row["kind"] in {"pause", "revisit", "skip", "exit"},
               "C08", "behavior labeled as inferred emotion or unknown event")
        consent = tables["consents"].get(row["consent_id"], {})
        expect(bool(consent), "C08", "behavior has no consent")
        if not consent:
            continue
        expect(consent.get("purpose") == "behavior"
               and consent.get("session_id") == row["session_id"]
               and consent.get("edition_id") == row["edition_id"]
               and row["edition_id"] in tables["editions"],
               "C08", "consent does not cover this session/edition/purpose")
        start = stamp(consent.get("granted_at_utc"))
        ends = [stamp(consent[x]) for x in ("withdrawn_at_utc", "expires_at_utc")
                if consent.get(x)]
        end = min(ends) if ends else datetime.max.replace(tzinfo=timezone.utc)
        at, received = stamp(row.get("at_utc")), stamp(row.get("received_at_utc"))
        expect(start < end and start <= at <= received < end,
               "C08", "event collected or ingested outside consent interval")

    for table in IMMUTABLE:
        for rid, row in before[table].items():
            expect(tables[table].get(rid) == row, "C09",
                   f"prior {table}/{rid} removed or rewritten")
    return {"status": "FAIL" if problems else "STRUCTURAL_EVIDENCE_VALID",
            "dataset_kind": meta["dataset_kind"], "app_revision": meta["app_revision"], "profile": profile,
            "scope": "supplied export projection only; runtime/human gates not assessed",
            "checks": (["C01 bytes", "C02 revision graph", "C03 saved-text oracle",
                        "C09 immutable history", "later-phase absence"] if profile == "writing" else
                       ["C01 bytes", "C02 revision graph", "C03 saved-text oracle",
                        "C04 proposals", "C05 decisions", "C06 editions",
                        "C07 feedback", "C08 consent", "C09 immutable history"]),
            "problems": problems}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--oracle", type=Path, required=True)
    parser.add_argument("--before", type=Path, required=True)
    parser.add_argument("--allow-synthetic", action="store_true")
    parser.add_argument("--profile", choices=("full", "writing"), default="full")
    args = parser.parse_args(argv)
    try:
        report = check(args.bundle, args.oracle, args.before, args.allow_synthetic, args.profile)
    except (InputError, TypeError, KeyError, AttributeError) as exc:
        print(json.dumps({"status": "BLOCKED", "reason": str(exc)}, indent=2))
        return 2
    print(json.dumps(report, indent=2))
    return 1 if report["problems"] else 0


if __name__ == "__main__":
    sys.exit(main())
