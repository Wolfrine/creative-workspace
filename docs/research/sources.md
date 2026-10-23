# Research sources

Accessed 23 October 2026. Primary product documentation supports feature descriptions; it does not demonstrate superior usability. Standards support the stated requirement, not a claim that Noveliaa conforms. Recommendations and numeric product budgets are the reviewer's proposed tests. No paid products were purchased or signed-in trials performed.

## Writing, knowledge and collaboration

| ID | Source | Evidence used |
|---|---|---|
| S1 | [Scrivener overview](https://www.literatureandlatte.com/scrivener/overview) and [snapshot recovery](https://www.literatureandlatte.com/blog/how-to-manage-compare-and-restore-snapshots-in-your-scrivener-projects) | Sections, outline/corkboard, adjacent research, composition and snapshot mechanisms. Product mechanism reference, not a hands-on comparison. |
| S2 | [Ulysses library](https://help.ulysses.app/the-library/ulysses-library) | Inbox sheets, groups and project isolation. |
| S3 | [Ulysses backups](https://help.ulysses.app/en_US/the-library/backups) | Local backups, external backup export and restoration. |
| S4 | [Obsidian graph view](https://obsidian.md/help/Plugins/Graph%2Bview) and [links](https://obsidian.md/help/links) | Explicit note links, filtered/global versus local graph navigation. |
| S5 | [Google Docs suggesting](https://support.google.com/docs/answer/6033474?hl=en) | Visible suggestions and accept/reject review. |
| S6 | [Novlr shared roles](https://help.novlr.org/en/article/who-can-see-what-on-shared-projects-u5zy5n/) | Beta readers cannot edit; independent feedback visibility differs from editor access. |
| S7 | [Novlr version history](https://help.novlr.org/en/article/where-can-i-access-my-version-history-1v1hk6n/) | Pause-triggered versions, dated read-only previews and explicit restore. No plan/pricing comparison is needed. |
| S8 | [Readwise Reader appearance](https://docs.readwise.io/reader/docs/faqs/appearance) | Typeface, size, line spacing, width and mobile appearance controls. |
| S9 | [SBS on The Boat](https://www.sbs.com.au/whats-on/article/the-sound-and-vision-of-the-boat/67xsuhjh5) | Publisher account of combining illustration, narrative and sound, with reader-paced scrolling and an auto-scroll option. Published 2015; a historical craft reference, not a 2026 compatibility certification. |
| S10 | [ink and Inky](https://www.inklestudios.com/ink/) | Text-first authoring, linked playable preview, source navigation and web export. It is interactive narrative middleware, not a recommended Noveliaa dependency. |
| S11 | [Doshi and Hauser 2024, Science Advances](https://doi.org/10.1126/sciadv.adn5290), [PubMed abstract](https://pubmed.ncbi.nlm.nih.gov/38996021/) | The short-story experiment reports individual creative benefits and reduced collective diversity. Publisher full text was blocked; the article abstract/index record was accessible. Do not infer effects on long-form novels or on this particular author. |

## Engineering and evaluation

| ID | Source | Evidence used |
|---|---|---|
| S12 | [Tiptap JSON/HTML output](https://tiptap.dev/docs/guides/output-json-html) | Structured JSON and HTML are storage/export options. Full archive completeness is a Noveliaa requirement, not a Tiptap guarantee. |
| S13 | [Firestore offline persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline) | Same-document changes use last-write-wins; web persistence is opt-in, is not automatically cleared between sessions, and pipeline operations do not support offline persistence. |
| S14 | [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) | Atomic writes and retry behavior; client transactions fail offline. |
| S15 | [Browser storage and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) | Best-effort storage, persistence requests, quota failure and private-browser deletion. Persistence does not protect against explicit user deletion. |
| S16 | [Firestore rule conditions](https://firebase.google.com/docs/firestore/security/rules-conditions) | Server client libraries bypass Firebase client Security Rules; trusted endpoints need their own authorization. |
| S17 | [MCP authorization security](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations) | Resource/audience binding and rejection of token passthrough. Validate the supported client/spec combination during implementation. |
| S18 | [Cloud Storage signed URLs](https://docs.cloud.google.com/storage/docs/access-control/signed-urls) | Possession grants access within the validity period. Application-link revocation alone cannot promise immediate revocation of an issued URL. |
| S19 | [Firestore text search](https://firebase.google.com/docs/firestore/enterprise/text-search) and [document limits](https://firebase.google.com/docs/firestore/quotas) | Text search requires Enterprise and text indexes. Maximum document size is 1 MiB; avoid an ever-growing manuscript/transcript document. Recheck edition/SDK before implementation. |
| S20 | [Firestore TTL](https://firebase.google.com/docs/firestore/ttl) | Expiry does not instantly remove records; queries/lookups can still return expired documents until deletion, typically within 24 hours. |
| S21 | [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/) | Targets/selectors, exact quotation with prefix/suffix, and explicit character-position conventions. A quote alone is ambiguous when repeated. |
| S22 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Keyboard access, visible focus, reduced disruption and accessible authentication are relevant release requirements; automated scanning is partial coverage. |
| S23 | [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [text spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) | Check a 320 CSS-pixel reading width and user spacing overrides without lost text or controls. A spatial graph can have a different layout but must have an accessible list equivalent for these tasks. |
| S24 | [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [drag alternatives](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | WCAG AA target minimum is 24×24 CSS px subject to exceptions; 44×44 for Noveliaa's primary touch controls is a proposed comfort target. Pointer alternatives to dragging are required where applicable. |
| S25 | [Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Normal text at least 4.5:1, large text 3:1 under the criterion's definitions and exceptions. |
| S26 | [Interaction to Next Paint](https://web.dev/articles/inp) | Good INP is at most 200 ms, evaluated at the 75th percentile of page visits. This does not replace typing-latency measurements or establish a lab keyboard budget. |

## Project evidence

The five Noveliaa planning files were read at [cf18fae](https://github.com/Wolfrine/creative-workspace/tree/cf18fae44127ec64a798ca28d01615966dc3ef07). The [Space architecture plan](https://chatgpt.com/space/page_6adb401a6e8c8191938924d0579291f3), [intent](https://chatgpt.com/space/page_6ad9dead8cec8191bd7a0b8236c9855e) and [prototype gallery](https://chatgpt.com/space/page_6adb3f8f2624819196ab0baa159f3157) are the reviewed proposal and design context.

Independently sampled, read only:

- [Novel-Encyclopedia entry service](https://github.com/Wolfrine/Novel-Encyclopedia/blob/45e397d82e7a0d6a4e90bc82e47ee24af0dbb3a5/encyclopedia/src/app/services/entry.service.ts): the inspected service uses updateDoc/deleteDoc directly and does not itself implement revisions or approvals. This is not a claim about every path in that app.
- [StoryForge architecture](https://github.com/Wolfrine/StoryForge/blob/4a33e8467af9491a22bf05796d0466fe5bc75d13/.harness/architecture.md): source/meaning/presentation/package separation is reusable as a concept. Runtime security and publishing behavior were not audited.
- [NovaSaga mixed source note](https://github.com/Wolfrine/NovaSaga/blob/e1931c8d0e86891ac6d0c35c460a74cd0a974793/raw/2026-06-02-luminaries-religion-context-guidance.md): distinguishes a User Thought from a discussion expansion. A legacy canon label would not resolve authorship by itself.
- [PTI MCP README](https://github.com/Wolfrine/PTI/blob/5cc2cd4ea87b48691d402249ce1fbb3d6b187f03/tools/pti-mcp/README.md): account-scoped OAuth, revocation and guarded write patterns. Its generic CRUD capabilities exceed Noveliaa's proposed agent permissions. No PTI endpoint or credentials were exercised.
- [Central release metadata](https://github.com/Wolfrine/Central/blob/653247d6e4601b136fcbb51306c9a72c29e691e7/plugins/central/release.json): version/source identifiers for the loaded design workflow; unrelated guidance was not changed.

The attachment's sampled contents informed preservation tests only. Original file modification time, platform conversation ID, original authorship and canon approval were not established. Hash/size identify the supplied bytes, not their creator.
