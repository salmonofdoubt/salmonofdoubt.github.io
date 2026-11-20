# EnvAI: design principles

**Primary audience: human environmentalists.** The atlas is a living, evidence-led
guide to useful environmental digital tools and their relationship to artificial
intelligence, not a developer repository directory or a showcase of AI jargon.

## Editorial and navigation rules

1. **Start with environmental meaning.** Visitors should find tools through
   subjects and problems they recognise: birds, fish, rivers, water quality,
   air pollution, forests, fires, climate and other coherent environmental topics.
   Organise the constellation as **environmental field → environmental purpose →
   individual application**. Keep navigation understandable without an MSc in AI.
2. **Explain AI without letting it dominate navigation.** Every approved tool
   independently carries one evidenced classification: Traditional digital,
   AI-augmented or AI-native. Display this using tool colours, accessible labels
   and a topic's subtle three-colour composition indicator. Do not create AI-type
   topic groups, featured-tool exceptions or a fourth AI class for discovery leads.
3. **Every usable tool remains findable.** Give each one a primary purpose, a
   direct access route, and source/AI-classification evidence. Expand topic
   nodes in bounded numbers; full group browsing and search still cover all
   members. New unassigned approved records must be visible as needing curation,
   never silently discarded.
4. **Protect the experience on phones and desktops.** On phones show one field
   with legible labels, controls, native vertical scrolling and larger touch
   targets. On desktops preserve the complete map. Avoid overlapping labels,
   intro text, colour keys and other overlays.
5. **Keep a living, trustworthy catalogue.** Daily discovery should prioritise
   actual applications from authoritative environmental sources across all
   fields. New candidates are unverified until assessed. Do not mistake a
   reachable URL for tested functionality. Do not retire a tool following a
   transient outage; preserve provenance.
6. **Judge additions from the environmentalist's perspective.** The first
   question is what the tool lets someone observe, investigate, monitor,
   predict or decide. The AI architecture follows as an explanation, not a
   prerequisite to using the atlas.

## Release checks

The constellation regression tests must verify every approved tool is assigned
exactly once, no tools appear arbitrarily alongside group nodes, each topic
retains mixed AI classifications, and the rendered mobile and desktop maps are
usable. A changed asset must be cache-busted and the PWA cache bumped.
