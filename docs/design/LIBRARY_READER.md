# Library and private author reading

Owner approved the proposed implementation on 25 October 2026: rename
collections, provide dedicated Library/collection views, replace the mobile
Export destination with Read, and add a private paginated reading experience.
Collections stay flat. Shared editions, publication, AI transformation and peer
feedback remain later work. Read mode does not designate material approved or
canon; original provenance remains visible.

## Design and operating contract

Retain Living Atlas and Quiet Folio. The Library makes an expanding body of
writing retrievable; the sidebar becomes bounded navigation rather than the
entire inventory. The reader makes the author's actual words the dominant
object, with quiet book typography and optional paper-turn motion.

Collections retain their identity when renamed. Inbox remains the permanent
destination represented by a null collection ID. Rename must survive restart
and offline work; a stale device must not silently undo another device's name.
An explicit concurrent rename requires a conscious choice of the local or
remote name. Collection metadata changes do not rewrite manuscripts, originals
or immutable revisions.

Reading is a semantic, selectable, read-only projection of a frozen local
snapshot. Contents follow the author's document order. A document may occupy
many reader screens. Typography and viewport changes repaginate while retaining
the passage location. Reading preferences and position initially stay local;
page turns do not write to Firestore. New remote writing cannot move the passage
being read beneath the author. Source changes can be deliberately reopened.

The existing 10-second trailing local save and 60-second trailing cloud save
remain. Entering the reader may perform a local-only safety flush. Turning a
page, changing reading typography or resuming reading must not create writing
revisions or force an early upload. Firebase remains on Spark.

## Observable review conditions, declared before scoring

1. Navigation: Library, collection detail, Read and return-to-writing are
   identifiable. Sidebar inventory is bounded; Export remains reachable.
2. Prose and pagination: exact source text remains readable and selectable;
   headings, lists, quotes, paragraph indentation and links retain semantics.
   No dropped, duplicated or clipped prose at page boundaries.
3. Hierarchy and restraint: manuscript/reader text dominates over controls;
   accepted serif/sage/paper visual language remains coherent. Motion is
   optional and respects reduced-motion preferences.
4. Responsive access: controls fit at 320/390/768/1440 CSS px; keyboard actions
   and non-drag organization exist; mobile controls remain reachable.

First-glance review hypotheses: the prose or Library title dominates at a
glance; within a second the current collection/reading context is identifiable;
within five seconds the next useful action is apparent. These are review
prompts, not measured attention or human acceptance results.

Required review states: populated Library pages and collections; collection
detail and rename; empty Library/reader; long reading on desktop and mobile;
reader appearance/contents controls; reduced-motion turning; writing after
reading; offline metadata/recovery and concurrent rename. Use synthetic fixtures
and the existing H02 retrieval/H08 accessible-reading procedures. Physical phone,
screen-reader and author comfort acceptance remain distinct from browser tests.

Central release used: 0.1.0, base
`ba1235fe7b220842778414f3f70fca38e7df4c53`. Roles: library_reader designer,
reader_critic independent visual critic, root lead and QA. Five substantive
state-specific review cycles and final build-bound evidence are required before
agent-reviewed release. Only an explicit owner response grants owner acceptance.
