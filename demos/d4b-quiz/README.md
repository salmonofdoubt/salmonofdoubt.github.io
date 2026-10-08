# D4B Evidence Quiz — ingestion and audit

This is a GitHub Pages PWA derived from `/demos/demo-template/`. It keeps a *public, original* question bank separate from imported private Moodle questions. The existing learner-progress localStorage key and stable question identifiers are retained.

## Four sources and actual access

| Source | Current capability | Ingestion |
| --- | --- | --- |
| Digital Leprechaun | Check public HTML and up to eight same-origin JavaScript asset fingerprints | **No copying** of peer questions; inspect new source changes and permissions before deriving original practice items |
| Get Styled D4B | Check public HTML and same-origin JavaScript asset fingerprints | Same restriction |
| User's Digital4Business Drive | Read with the explicitly connected ChatGPT Drive connector during an authorised content-review session | No background Drive OAuth or GitHub Actions credentials configured |
| User's quiz conversations | ChatGPT can recover some supplied messages or read a user-provided export | No full-conversation API connection to the public website |

Private original Moodle questions must remain browser-local or in an expressly authorised private store. Never commit private quizzes, Drive booklets or ChatGPT exports to this public repository.

## Supported refresh pipeline

The authenticated `.github/workflows/d4b-refresh.yml` workflow performs:

1. **Check external sources** — downloads public site shells and linked first-party JavaScript assets; records only hashes, asset counts and changed/unavailable statuses.
2. **Incorporate vetted candidate questions** — reads `candidates.json`, validates four options, correct-answer index, module/week, source, provenance, stable IDs and collision-free stems; adds approved *original* questions idempotently to `questions.js`.
3. **Audit question bank** — checks shape, duplicate IDs and stems, week coverage, verification metadata, answer-key formatting and evidence requirements.
4. **Consolidate** — creates an ingestion report, source check, audit report and manifest with timestamps, counts and explicit access limitations.
5. **Publish** — commits the consolidated public bank and cache-busted PWA asset URLs only if all preceding stages succeed.

Click **Refresh via GitHub** on the quiz, then select **Run workflow** on `master`. The website reads *real* GitHub Actions step state and displays the successful consolidation date and new-question count. Because this is a static public site, refresh **does not** directly hold or use a GitHub write token. A truly single-click action requires an owner-authenticated backend.

The pull-request workflow tests the ingestion without publishing. It also runs ingestion a second time and requires zero new questions on the repeat, thereby testing idempotence.

## First batch

- Previously available: 55 original, booklet-derived MCQs across 18 documented module-weeks.
- `candidates.json`: 36 additional original MCQs (two per documented week).
- The next successful production refresh following merge ingests 36, giving **91 public questions** if nothing else changes.
- Nine original questions have been independently checked against named primary technical research or a competent authority, each with a source URL and precise locator.
- All remaining items are **pending independent verification**. A structural audit passing is not academic verification.

### Candidate question schema

`candidates.json` contains an `items` array of questions with immutable IDs, module `GEN`, `AIB`, `INN`, `DTR`, week integer, topic, stem, four choices, zero-based correct index, explanation, source, origin `booklet-derived`, verification `pending`, and evidence `{source, originalMaterialChecked:false}`.

Do **not** re-use an existing ID for a revised question with a different answer. Keep the old ID retired and allocate a new ID, so that historical accuracy/mistake statistics remain meaningful.

### Verification

- `pending`: rationale has not yet been independently checked against an authoritative original source.
- `verified`: the answer and alternative options were checked, and the record carries `evidence.url`, `evidence.locator`, `evidence.originalMaterialChecked=true`, `evidence.reviewed_at`.
- `flagged`: ambiguous, contradictory or incomplete; requires review and should not be promoted to verified.
- An *official lecturer answer key* can be recorded separately in the private Moodle import. It is **not** synonymous with independent correctness.

Verification takes academic judgement. The automation checks evidence metadata exists, not whether the original paper logically proves the key. Never infer official quiz questions or answers from lecture-note summaries.

## Browser-local Moodle questions

The **Official Moodle quizzes · private import** control accepts a JSON file. This is stored in browser localStorage and is not synced, uploaded, or included in public GitHub Pages deployments. It preserves original wording and official-key state where available. Export your local history before clearing browser storage.

## Operational testing

Before merging code changes: inspect the PR's D4B Evidence Refresh check; it must pass including idempotency. After a merge: run `master` manually, ensure the generated `ingestion-report.json`, `audit-report.json`, `consolidation.json` and `questions.js` are committed and Pages deployment succeeds.

Test desktop and mobile for selection highlighting, ability to switch answer until submitted, explanation/source links, responsive filters, timed exam mode, install control, DOI floater, private import, history persistence, no horizontal overflow and installed-PWA freshness.

## Important remaining connectors

Automatic full-text extraction from either peer site is not implemented (access/reuse permission not established). Automatic ingestion from the user's Drive and ChatGPT conversations in a GitHub Actions run is **not implemented** and requires a private authorisation/deployment design. The current refresh ingests new *staged original* questions and monitors external content hashes; it does not hallucinate lecturer questions or claim every question is verified.

## October 2026 quiz recovery and traceability

The source-review session on 9 October examined the four current MSc summary booklets, mapped the **91 public questions to their 18 module-week sections**, and produced `booklet-traceability.json` with per-item lexical location evidence. **This is not independent answer verification**: the pre-existing nine primary-source-verified items remain the only items marked `verified`, while 82 still need complete answer/distractor checks against the relevant original teaching and/or academic source.

Every successful refresh also generates `review-queue.json`, an item-by-item to-do list keyed by stable question ID, verification status, current evidence URL/locator, and required next action. The queue is derived from `questions.js` so adding questions does not create a separate synchronisation problem. A `flagged` item is excluded from scored practice.

The private recovery pack supplied in the ChatGPT session contains two full original AI for Business W5 Moodle items (Q6 and Q7), with all answer options recovered from the conversation context. It also records 13 quiz assessment/result entries from the booklets **without** pretending that their answer-topic summaries are complete Moodle question transcripts. One conflict exists between answer-letter sequences for Innovation W4, which must be reconciled from original graded Moodle output before importing any such letter answers. These original quiz records must not be uploaded to this public repository.

**Source limitation:** previous-conversation retrieval was unavailable during the session. The recovered inventory is a documented first pass, not an exhaustive history scrape. The public workflow still cannot access the private ChatGPT and Google Drive connectors.
