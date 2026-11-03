# Runtime pass 4 — frozen for independent review

Status: **ready for independent review; no designer acceptance or scores**. Ten PNGs were captured after the parent and designer froze runtime source. All ten were personally viewed. Preserve these images and source fingerprints while formal QA runs.

The key now uses actual SVG line samples with the current's color, width and solid/dashed/dotted pattern. The Unicode glyphs are gone. Feeling names are 13px on phones and desktop. Night accents apply only to the actual night reader key; native light dialogs use the light accents against their actual light paper. The guide has three small Held/Rest/Unanalysed examples, one short disclaimer and accessible interpretation metadata. Complete reasoning and exact source remain available on demand.

The separate `../round4-study` comparison preserves the left margin at 20px and rail at x8 while widening comfortable 320px prose from 280px to 288px, with a 12px right margin. Both studies retained 20px/1.85 and zero overflow. The complete scene's scrollHeight fell from 2381px to 2344px. This limited change was adopted for comfortable widths <=350px; generous margins remain unchanged.

Reader integration also passes the frozen documents to the parent's honest unanalysed fallback and adds a dotted key only when meaningful text from another document is actually visible. It introduces no extra requests. An invalid display map also produces Unanalysed instead of suggesting missing text. Parent owns the new source rails and their per-document metadata.

| Main viewport | Layout | Footer | Prose width | Full prose lines |
| --- | --- | ---: | ---: | ---: |
| 1366x590 | Pages | 66px | 533px | 19 |
| 1366x768 | Pages | 66px | 533px | 28 |
| 390x700 | Scroll | 70px | 350px | 13 |
| 390x844 | Pages | 68px | 350px | 17 |
| 320x568 | Scroll | 70px | 288px | 10 |

Additional actual states: night reasoning dialog at 390x844, revised guide at 390x844, explicit Rest at 320x568, sparse/unanalysed at 320x568 and writer at 320x568. Reader typography remains 20px/37px in all nine reader states. Writer retains its existing 18px/33.3px mobile typography; this lane did not change it.

Measured SVG graphic contrast minima against the actual opaque ancestor paper: main key 3.1558:1, light reasoning dialog in Night mode 3.6778:1, guide 3.6778:1, Rest/Unanalysed 3.2436:1 and writer 3.5994:1. Real-label minima are 6.6375:1 or higher. No swatch contains a text glyph. These are paint/contrast checks, not aesthetic judgments or color-vision acceptance.

`geometry.json` retains image hashes, exact annotation/source partitions, continuous and unanalysed path metadata, three stable readiness frames, actual contrast pairs and all measured main footer control rectangles. All five main footer control sets fit inside their footer and viewport. Across all ten states: zero horizontal overflow, unchanged synthetic source and zero page errors. All 54 source/fixture hashes matched before and after capture; see `source-fingerprints.json`.

Five native probes passed: exact UTF-16 anchor through Heartbeat toggle and layout changes, width/height reflow, 20→22→20 body-size reflow, actual PageDown movement/bookmark update, and genuine keyboard focus. The retained source anchor is passage 1/offset 266; native scrollTop remains 768px across toggles and round trips. Keyboard PageDown retains the existing 2px green focus-visible outline (`rgb(140, 167, 123)`), deliberately unchanged. The earlier focused long-reading image was inspected as a focus diagnostic, not presented as an accepted steady-state render.

`npm run typecheck` passed. All input is public synthetic AI fiction; no production manuscript, private annotation or plugin/backend operation was accessed or changed. No commit or deployment. Independent visual critique, formal QA and the remaining focused pass are pending. No more runtime changes until the parent opens the next pass.
