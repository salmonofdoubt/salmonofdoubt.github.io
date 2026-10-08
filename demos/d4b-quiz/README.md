# D4B Evidence Quiz (prototype)
Based on the site's established `demos/demo-template/` production shell. This is a separate unpublished prototype branch.
- 20 authored, single-answer MCQs, four modules, named booklet sections
- adaptive review, timed mock mode (90 seconds per question), wrong-answer mode
- local progress only; no login, tracking of quiz answers, backend, or sync
- install/fallback, scoped service worker, mobile design, DOI placeholder
- Questions are *original practice items*, not official assessments. No source booklet contents are published.
## Known constraints
- The public Digital Leprechaun site was reviewed for UX concepts, not copied or scraped; its question-bank contents were not accessible.
- No automatic Google Drive ingestion. Adding questions requires manual, source-checked edits to `questions.js`.
- There are only 20 seeded questions, so a 30/40-choice session will be shortened to available items without duplication.
- The source references name booklet sections but do not directly link to private Docs.
- Repetition uses a simple due-time schedule; this is not a psychometrically validated mastery score.
## Verification
Open `/demos/d4b-quiz/` on branch preview or after merge. Check module/week selectors, immediate feedback, mistakes, timer, browser reload persistence, reset/export, install, offline reload, responsive layout, and pinned DOI.