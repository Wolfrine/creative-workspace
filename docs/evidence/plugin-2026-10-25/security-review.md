# Noveliaa private plugin — independent boundary review

Reviewer: `/root/plugin_critic`, separate from implementation and the UI scores
in `ui/critic.md`. No production calls, credentials or author writing accessed.
Application source is reviewed read-only. The parent explicitly authorized the
reviewer to retain one narrowly owned regression file after finding the race:
`functions/test/mcp-oauth-races.test.mjs`.

**Current verdict:** no unresolved authorization/source-integrity blocker found
in this focused review after the repairs below. The reviewer ran both
deterministic refresh schedules against the repaired actual provider: 2 passed,
0 failed/skipped. Parent emulator/HTTP and production verification remain
separate evidence.

Reviewed `functions/src/integration-{oauth,http,store,writing,tools,cleanup}.mjs`,
`functions/src/mcp-entry.mjs` and `functions/test/mcp-integration.test.mjs`.
Also read the installed MCP SDK's token, registration, authorization and client
authentication handlers to avoid treating delegated checks as missing.

## Concurrent refresh replay — resolved in reviewed source

The first implementation checked `_noveliaaMcp/spent` before rotation, then only
failed a losing refresh transaction. Two concurrent users of the same refresh
token could both see no marker; one received new tokens and retained access
after the other failed. That defeats the promised refresh-family replay
revocation. Existing sequential replay coverage did not establish the concurrent
case.

The first parent repair re-reads the marker in `exchange()`'s consume catch.
First-repair reviewed OAuth source SHA-256:
`154dcbc25ac019511361edb6c4ee26f2564ef1af8a49103de916a95a2a026435`.
This fixes the losing transaction interleaving, but not an earlier failure:

- `integration-oauth.mjs:117`: `get('spent', token)` can see no marker in both
  calls before either rotates.
- `integration-oauth.mjs:89`: `checked(await this.store.get(kind, key))` runs
  **before** the try/catch at lines 96–112. If the winner commits before the
  loser reads the refresh source, this read returns absent and throws outside
  the repair.
- `integration-oauth.mjs:123`: `return this.exchange(...)` has no outer catch to
  detect the now-committed spent marker.

Confirmed using the actual current `NoveliaaOAuthProvider` with an in-memory
atomic-consume store and deterministic read barriers. No emulator, filesystem
mutation, network or production access was used. The store returns absence for
the first two marker snapshots only, then reads the committed marker normally.
Node command output, tool chunk `d2012c`, exit 0:

```json
{"scenario":"both read refresh source before consumption","results":["fulfilled","rejected"],"grantRevoked":true,"winnerTokenAccepted":false}
{"scenario":"winner commits before loser reads refresh source","results":["fulfilled","rejected"],"grantRevoked":false,"winnerTokenAccepted":true}
```

The first earlier reproducer (`fa47dd`) held every spent read empty; it must not
be used to assess the repair. The corrected two-schedule result above is the
relevant evidence.

Required correction identified: catch failure around the **entire awaited refresh
exchange**, then re-read the spent marker and revoke its matching client/grant,
including failures before consume. Retain real HTTP concurrent coverage plus a
deterministic test of the missing-source interleaving. Re-run the corrected
counterexample: both schedules must leave any winning rotated token unusable.

Parent's second repair inspected in current `integration-oauth.mjs:113–120`:
the whole `await this.exchange(...)` is now inside try/catch, with shared
`revokeReplay` invoked both before exchange and after any failure. Current
repaired source SHA-256:
`4719e92f9fed40f5c73c42dcf907ba02ddf175ace48f04ecf7854fecb42eda72`.

Retained deterministic tests in `functions/test/mcp-oauth-races.test.mjs` model
both source reads before consume, and the winner committing before the loser
reads the source. The latter previously threw before the first repair's catch.
Both tests require exactly one winning exchange, a revoked grant, rejected
winning access token, and rejected winning refresh token. Later marker reads
observe the committed marker normally, avoiding the first harness limitation.

Executed from the owning F-drive repo after loading its development environment:

```text
node --test functions/test/mcp-oauth-races.test.mjs
2 tests; 2 passed; 0 failed; 0 skipped; exit 0
```

Observed command/tool chunk `7f4372`. Real HTTP concurrent coverage was also
inspected at `mcp-integration.test.mjs:162–168`; parent runs the Firestore/Auth
emulator lane independently. The specific replay finding is resolved by the
current code plus the reviewer's executed deterministic regressions.

## DCR default method — source repair inspected

The SDK registration handler creates a confidential client secret when
`token_endpoint_auth_method` is omitted. The provider originally accepted this
omission as though it meant public `none`, then returned an unspecified method;
standards-based clients can default to Basic, while the installed SDK's
`clientAuth.js` reads credentials only from the POST body. This was a concrete
interoperability ambiguity, not evidence of unauthorized data disclosure.

Parent repair inspected at `integration-oauth.mjs:21–25`: registration now
returns explicit `client_secret_post` when an SDK-generated secret exists, and
`none` for a public client. `mcp-integration.test.mjs:91–94` asserts the default
registration response. Parent's actual emulator/HTTP rerun is pending in this
review; source alone does not prove real ChatGPT registration succeeded.

## Boundaries supported by inspected source

Line references below identify the initial reviewed snapshot; the repaired
refresh method shifts later OAuth line numbers without changing these checks.

- Exact resource binding is checked before exchange (`integration-oauth.mjs:30,
  88`) and again on access verification (`:127–129`). Registered redirect URIs
  are restricted to exact documented ChatGPT callback forms (`:14–19`); SDK
  `authorize.js` enforces registered redirect matching and S256 method, and SDK
  `token.js` calls `verifyChallenge` before provider exchange. Ignoring the
  provider's `_verifier` argument is therefore not a PKCE bypass.
- Every private tool requires OAuth and read/proposal scopes
  (`integration-tools.mjs:14–19`). Author identity, disabled/revoked Firebase
  sign-in and current workspace generation are rechecked
  (`mcp-entry.mjs:11–19`; `integration-store.mjs:26–29`;
  `integration-oauth.mjs:76–81`). Reset invalidates old workspace grants.
- A page read checks the current head's granted universe, revision identity and
  universe, chunk and full-byte hashes, body projection and current trash status
  (`integration-writing.mjs:11–38`). No confirmed cross-universe read bypass was
  found in this review.
- Submission checks the exact source revision/hash, and its transaction checks
  current owner/workspace, active grant and proposal/universe permission before
  creating an immutable collaboration record (`integration-writing.mjs:78–98`).
  It has no source-writing update. Review writes separate decision records with
  `approvesCanon: false` (`integration-http.mjs:61–72`).
- Author API writes require same-origin JSON plus a verified Firebase identity
  (`integration-http.mjs:17–24`). Consent also requires its pending browser
  cookie hash (`integration-oauth.mjs:43–46,66–69`).
- Weekly cleanup enumerates only five expiring OAuth namespaces and never
  traverses author data, grants or clients (`integration-cleanup.mjs:5–17`).
  The deployed entry exports only the scoped HTTP Function
  (`mcp-entry.mjs:21–23`), not the old Storage callables or backup schedule.

## Verification limits

This is a focused code review and executed deterministic concurrency regression,
not a general penetration test. The reviewer has not run the parent's live emulator
suite, deployed Function identity, Hosting proxy/rate-limit behavior, real
ChatGPT DCR/OAuth consent or plugin installation. Per-instance rate limits bound
ordinary requests; distributed abuse resistance was not established. Existing
source and tests cover several boundaries but do not prove every concurrency
interleaving. UI visual acceptance remains a separate record.
