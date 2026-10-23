# Noveliaa evaluations

Research-stage acceptance package. No application exists at the reviewed commit, so **all product cases are NOT RUN**. Passing the evaluator's own tests is not passing Noveliaa.

## Run what is executable now

Python 3.11+; standard library only; no Firebase credentials, network, model API or app implementation.

~~~sh
python3 -m unittest discover -s evals -p 'test_*.py' -v
python3 evals/check_evidence.py --help
~~~

The mutation tests generate small synthetic exports in temporary directories. They demonstrate that the checker rejects damaged originals, rewritten history, missing saved text, invalid references, unapproved editions and events outside consent. They do not simulate Firebase or implement the domain model.

When a real export adapter exists:

~~~sh
python3 evals/check_evidence.py /path/to/after/bundle.json --oracle /separate/path/oracle.json --before /path/to/before/bundle.json
~~~

The [evidence contract](contract.md) is a test projection, not a mandated database schema or a product export design. Keep the independently captured oracle outside the app's exported bundle. A self-reported hash alone would allow text and its checksum to be rewritten together. The checker accepts a synthetic bundle only with --allow-synthetic. Exit 0 means structural checks passed for supplied evidence; exit 1 means an invariant failed; exit 2 means missing, malformed or ineligible evidence. It never declares release readiness.

## Product execution

[Automated cases](automated.md) define browser, emulator, API, restore and capture procedures with observable oracles. Codex should implement adapters using the real app's interfaces after development is approved. There are no assumed production endpoints or fabricated passing browser tests here. [Human cases](human.md) cover writing, navigation, fidelity, mobile typing, visual quality and peer experience.

For each case retain: case ID, PASS/FAIL/BLOCKED/NOT RUN, candidate commit and deployed asset identity if applicable, fixture hash, environment/browser/device versions, exact command or steps, UTC run time, expected and actual result, and evidence paths/hashes. Redact tokens and private manuscripts. Use invented fixture material for automated captures; real author/peer recordings need their own consent and private storage.

Missing evidence is BLOCKED, not PASS. A disabled optional feature can be N/A only with a stated reason and proof it is absent. Consent-denial and absent-media fallback cases remain applicable even when rich telemetry/media is deferred.

## Gates

| Gate | Required evidence |
|---|---|
| G1 Recoverable writing | A01–A11, A22–A24 and H01–H04. No lost acknowledged text or damaged originals. |
| G2 Safe external collaboration | A12–A16, A25–A26 and H05; one real client conversation with readback and source-revision traceability. |
| G3 Approved private edition | A17–A20 and H06–H08; exact text/assets and author-only approval. |
| G4 Respectful feedback | A21, A27–A29 and H09–H10; real private reading with consent choices. |
| Final release | All applicable P0 cases pass; no unresolved critical data loss, unauthorized access, silent canon change or publication. All human blockers resolved and the author explicitly accepts the candidate. P1 failures require a recorded author decision before release. |

Budgets in the cases are proposed Noveliaa targets, not research-derived universal cutoffs. Record a baseline and revise targets explicitly before running a candidate; never lower them after observing a failure simply to call it a pass. Friendly pilots with 3–5 participants are formative, not statistically reliable rankings.

Read the [research review](../docs/research/noveliaa-review-2026-10-23.md) for the rationale and [sources](../docs/research/sources.md) for evidence limits.
