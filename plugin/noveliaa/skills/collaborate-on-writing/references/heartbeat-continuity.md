# Read an emotional current before making labels

This method supports external AI interpretation of exact writing. It does not
measure readers or know author intent. No source edits, canon or publication.

## Interpretation pass

Read the whole available scene and its accessible narrative context before
choosing colors or offsets. Note what happens now, what is remembered, and what
remains unresolved. Draft a small arc: desire or expectation, change/resistance,
sustained state, and any payoff. Do not force those stages onto a scene that does
not contain them. Name ambiguity rather than filling it.

For each natural region ask what feeling is evidenced, whether the next passage
changes or holds it, and whether a contrasting undertone is supported. Separate
explicit wording from inference. Do not collapse restraint or doubt into joy.

Dates, lists, travel, setting and explanatory history often carry an established
baseline. A held span may cross several sentences or paragraphs. Factual wording
alone does not establish neutrality. Do not create a new tag just because a
sentence ends, or import fixed labels from an example, prior analysis or palette.

## Exact coverage pass

Partition the complete fetched text into a few justified regions. Use UTF-16
offsets and exact quotes; include boundary whitespace in a neighboring span.
Start at0, make adjacent regions meet, and end at `totalCharacters`. Check every
`text.slice(start,end) === quote`. Never split an emoji surrogate pair. Every
meaningful source unit must be explicitly covered; the app does not interpolate
emotions over missing text.

Keep one state across factual material when context supports holding. If a
region exceeds the2000-unit quote bound, split only for transport and repeat
the same feeling tuple so the display can merge adjoining chunks. At most80
spans and96KiB serialized input are accepted. If a complete scene cannot fit,
disclose the limit; do not call a partial submission complete.

Trajectory describes build/hold/shift/release/quiet. Use neutral+quiet for a
specifically analyzed rest, not unread text. Empty beats over nonempty writing
are incomplete coverage, not evidence of neutrality. Emotional weight1–5 is not
model confidence.

Tone is a color family, not a proved emotion taxonomy. Choose consistently:
warm for pleasure/anticipation, tender for affection/remembered attachment,
wonder for curiosity/possibility, cool for calm/restraint, tense for friction,
somber for disappointment/loss, neutral for explicit rest. Explain contextual
choices. The legend uses returned foreground words; cool need not mean distance
and warm need not mean happiness.

## Worked synthetic contrast

Source (invented, not author writing):

> The hall was almost ready. She counted the chairs once more, smiling. The dates
> on the programme recalled years of waiting. Then the final guest cancelled.
> She put one chair away and left the door open.

One reading groups the first three sentences into a held anticipatory state:
the chair count and dates sustain waiting rather than creating blank gaps.
Cancellation creates disappointment with an undertone of persistence. The last
action may hold that mixture; it does not prove renewed happiness or despair.
Alternatives remain possible. Explain uncertainty instead of sharpening the arc
without evidence.

Bad patterns: sentence-by-sentence tags; blank factual middle; joy merely because
there is a smile; confident grief without evidence; neutral used to hide
uncertainty; or treating an empty beat array as a quiet analysis.

## Quality check and writeback

Before the requested append, check source identity, full coverage, natural
boundaries, supported foreground/undertone and available context. Compare with
an independent raw-text reading when available; do not prime that reader with
prior labels or product goals.

Coverage checks prove structural completeness, not emotional correctness.
Provider/model are self-reported. Use authorized `submit_heartbeat` only, with the
current revision/hash and a new idempotency key. Inspect the receipt: the server
must report continuous coverage. Identical network retries reuse the key;
changed content uses a new one. Never reanchor stale material without rereading.
The result remains a separate unverified AI interpretation.
