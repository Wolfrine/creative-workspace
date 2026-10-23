# Verification record

23 October 2026 · Research/evaluation package based on creative-workspace commit cf18fae44127ec64a798ca28d01615966dc3ef07.

| Check | Actual outcome |
|---|---|
| Python 3.12.14: python3 -m unittest discover -s evals -p 'test_*.py' -v | PASS: 22 tests. These test the evidence checker using synthetic temporary exports. |
| python3 evals/check_evidence.py --help | PASS: usage and required evidence arguments displayed. |
| CLI result semantics | Tested: 0 for a valid synthetic projection with explicit opt-in, 1 for damaged evidence, 2 for missing/ineligible input. |
| Mutation coverage | Damaged bytes; original rewritten with a recomputed self-hash; missing saved text; changed history; cycles/cross-universe references; missing AI source; agent approval; AI-origin laundering; approval digest mismatch; unapproved edition/assets; changed existing edition; wrong feedback anchor; consent boundaries/late upload/disabled behavior; restore origin; duplicate/empty evidence; path escape/symlink; naive timestamp; synthetic/runtime separation. |
| Product cases A01–A29 | NOT RUN: no application exists at the reviewed base. Procedures and evidence requirements are defined. |
| Human cases H01–H10 | NOT RUN: no participant sessions, physical-device typing trial, independent visual critic score or author acceptance was obtained. |
| Builds, Firebase emulators, deployments, imports and PTI integration | NOT RUN. No application, credentials, settings or other repository was modified. |

The review used current primary documentation, the Space plan and three concept images. It is a planning critique, not a runtime security audit or proof of literary/visual quality. Product gate verdict remains UNVERIFIED.
