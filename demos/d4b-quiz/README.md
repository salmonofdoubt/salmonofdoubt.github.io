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

Checks run automatically on reviewed changes and daily. The site displays real GitHub Actions steps and the latest public consolidated report; manual dispatch remains an optional operator fallback. There is no browser-held write token.

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

Before merging code changes: ensure the PR's D4B Evidence Refresh check passes, including idempotency. Approved quiz changes merged to `master` trigger an automatic refresh; check the resulting `ingestion-report.json`, `audit-report.json`, `consolidation.json` and Pages deployment. Manual workflow dispatch is a fallback, not a required release step.

Test desktop and mobile for selection highlighting, ability to switch answer until submitted, explanation/source links, responsive filters, timed exam mode, install control, DOI floater, private import, history persistence, no horizontal overflow and installed-PWA freshness.

## Important remaining connectors

Automatic full-text extraction from either peer site is not implemented (access/reuse permission not established). Automatic ingestion from the user's Drive and ChatGPT conversations in a GitHub Actions run is **not implemented** and requires a private authorisation/deployment design. The current refresh ingests new *staged original* questions and monitors external content hashes; it does not hallucinate lecturer questions or claim every question is verified.

## October 2026 quiz recovery and traceability

The source-review session on 9 October examined the four current MSc summary booklets, mapped the **91 public questions to their 18 module-week sections**, and produced `booklet-traceability.json` with per-item lexical location evidence. **This is not independent answer verification**: the pre-existing nine primary-source-verified items remain the only items marked `verified`, while 82 still need complete answer/distractor checks against the relevant original teaching and/or academic source.

Every successful refresh also generates `review-queue.json`, an item-by-item to-do list keyed by stable question ID, verification status, current evidence URL/locator, and required next action. The queue is derived from `questions.js` so adding questions does not create a separate synchronisation problem. A `flagged` item is excluded from scored practice.

The private recovery pack supplied in the ChatGPT session contains two full original AI for Business W5 Moodle items (Q6 and Q7), with all answer options recovered from the conversation context. It also records 13 quiz assessment/result entries from the booklets **without** pretending that their answer-topic summaries are complete Moodle question transcripts. One conflict exists between answer-letter sequences for Innovation W4, which must be reconciled from original graded Moodle output before importing any such letter answers. These original quiz records must not be uploaded to this public repository.

**Source limitation:** previous-conversation retrieval was unavailable during the session. The recovered inventory is a documented first pass, not an exhaustive history scrape. The public workflow still cannot access the private ChatGPT and Google Drive connectors.


## Independent academic source verification: 82-question audit (10 October 2026)

All **82 formerly pending original public practice questions** received an individual answer-and-distractor review. **78** were corroborated against independently located original academic research or competent-authority technical publications and promoted to `verification: verified`. **Four** remain `pending`, with detailed evidence gaps:

- `d4b-063`: the "prefer the smallest valid model" rule is a plausible course-specific heuristic but not an independently established lecturer-specific requirement.
- `d4b-076`: the lecture's `Innovation = Invention × Commercialisation` mnemonic is a pedagogic formula, not the OECD Oslo Manual's universal definition of implemented innovation.
- `d4b-115`: the precise ordering `Frame → Scan → Imagine → Decide → Design` is specified in the private lecture summary, without an equivalent original external standard.
- `d4b-120`: the exact attribution of the roots/trunk/branches platformization-tree metaphor is not substantiated by an accessible original van Dijck passage, although the concept is in the lecture booklet.

`verification-review-20261010.json` records all 82 decisions, explicit source URLs/locators, keyed answer index, each of the three checked alternative answer indices and a **content fingerprint of the question and explanation at time of review**. New CI test `scripts/test-d4b-independent-verification.cjs` guards these audited records against silent wording/key changes. Source-backed status means the answer is independently supportable, **not** that the lecturer's private Moodle grading keys have been recovered or that a course-specific rubric has been independently authenticated. Future questions may be added without changing the historical 82-question audit; changed historical questions need an explicit renewed evidence review and corresponding fingerprint update.

After this release the 121-question bank has **117 independently source-supported** and **4 pending** public questions. Public release metadata and PWA cache are bumped, but stable IDs, user practice progress and browser-private original Moodle imports remain unchanged.

## D4B RELEASE: full current-booklet reconciliation (10 October 2026)

This release process reviewed **all four current canonical MSc module booklets** through the authorised connected Google Drive tool. Their existing module-week coverage is GEN W1–5, AIB W1–5, INN W1–5 and DTR W1–4; no newly published week or Semester 2 module was found in the accessible course-booklet search. The existing question bank already covered each of those 19 weeks. A targeted audit identified 16 distinct **underrepresented concepts**, which were covered by original questions d4b-106–121 (four per module) in merged PR [#204](https://github.com/salmonofdoubt/salmonofdoubt.github.io/pull/204).

The release was accepted at the GitHub-reported merge time **2026-10-09T23:08:19Z**. In the public `content-updates.json`, eight module/week events reference that same accepted PR and record exactly which stable IDs were introduced to each section. This is *one* cross-module publication, not eight separate deployments. `publicationLedger()` checks each record against the bank and produces grouped publication data for the website while retaining item-level source traceability. The historical INN W5 PR #202 remains represented independently.

All 16 new items are `course_alignment: supported`, `verification: pending`; no direct lecturer-grading or external academic verification is claimed. Recoverable module-chat/quiz feedback was reviewed as context, but the exact original Moodle text and all answer choices could not be recovered with adequate confidence; no Moodle originals are included in the public question bank.

Both peer quiz websites remain monitored through GitHub's public HTML/asset fingerprint checks. This does not grant permission to copy questions, guarantee complete semantic parsing or constitute question ingestion. A direct public read of Get Styled was unavailable in this review environment, while the existing GitHub runner had reported its HTML reachable. **Use actual runner checks** for status and retain an explicit limitation in reports.

## On-site ingestion and source provenance ledger

The public quiz now shows three **non-interchangeable** facts in its **Refresh evidence** panel:

- **Last reviewed learning added** — sourced from `content-updates.json`. Each approved release entry includes the exact merge timestamp, public source label, module/week, original public practice question IDs and a link to the merged PR. **Only releases that have evidence-backed entries are represented.** Historical releases before the ledger existed are not reconstructed from guesses.
- **Last automated question import** — sourced from the GitHub workflow's `ingestion-report.json`. An additions count of zero means nothing was *newly staged and inserted during that particular run*, even if the approved question bank recently gained questions in an earlier reviewed PR.
- **Last source check** — the availability/fingerprint check date for Digital Leprechaun, Get Styled, and the explicit lack of GitHub Actions access to Drive and ChatGPT. A changed external fingerprint is **not** a claim that peer quiz questions have been imported.

The workflow checks every ledger event against the published `questions.js`: IDs must exist, match the declared module/week, appear only once across release entries, and have a genuine recorded date and GitHub PR link. It rejects invented provenance on a subsequent consolidation run. The browser only displays claims present in those checked records, never infers source ingestion from a successful workflow status.

**For every future reviewed source release**, append a new `content-updates.json` event in the same reviewed commit as the newly authored public questions, or in a follow-up reviewed metadata commit referencing an already merged PR and its true timestamp. Include only source labels, public question IDs and approved release evidence. Never include private booklet text, source credentials or Moodle originals. The workflow will regenerate the embedded provenance summary in `consolidation.json` automatically. The latest event supported by the initial ledger is Innovation W5 (14 original questions, PR #202, 9 Oct 2026). This initial record does **not** imply the other historical releases never occurred.

## Innovation Week 5 and private source boundaries (9 October 2026)

The user's connected private Innovation booklet now includes W5 topics on concrete behaviour-change techniques, ethical nudges and defaults, truthful social proof, the adjacent possible, the Double Diamond, lateral/vertical thinking and divergent-thinking metrics. Fourteen **new, original** course-aligned practice questions (d4b-092 to d4b-105) were authored after the booklet was read through the authorised ChatGPT Google Drive connection. Their source labels name the corresponding booklet Week 05 section, without republishing the private slides or full Moodle wording. They remain pending *independent* academic source verification. The booklet itself reports a Moodle quiz result and answer-letter sequence but does not reproduce the complete original question and option text; do not silently convert such a summary into purported verbatim Moodle items.

**Why the original site appeared stale:** a successful public GitHub Actions refresh was only a source fingerprint check plus ingestion of *already staged* original questions. It cannot read the user's ChatGPT-connected Drive or detect whether that private booklet has a new week. Updating Google Drive and then pressing GitHub Refresh alone will therefore not add questions. The quiz now states this prominently. The connected ChatGPT source-review workflow is distinct from GitHub Actions; a genuinely unattended ingestion of private Drive sources needs an explicitly authorised private adapter, safe source retention and a reviewed/deployable public-data boundary.

For each new module-week addition, publish the matching curriculum entry and original answer-audited question records **together** in the reviewed PR, so GitHub Pages deploys the whole bank on merge. Also stage candidate records idempotently for the GitHub integrity check, derive candidate counts dynamically (never hardcode 36), and bump the bank asset URL plus scoped PWA cache. Private browser-local Moodle imports and learner-history storage must be preserved.

## Unattended source checks and consolidation (October 2026)

After the automatic-refresh change, the D4B refresh workflow runs **after relevant reviewed changes are pushed to master** and **daily at 06:23 UTC**. The previously available manual GitHub workflow trigger remains an optional operator fallback; a student is not expected to run it after each merge. Pull-request checks still audit without publishing.

The workflow records the public source fingerprints, validates staged *original* question records, checks integrity, and writes public consolidation metadata to master. Because GitHub Pages' source-branch builder is **not triggered by commits created with GITHUB_TOKEN**, the web interface reads the latest public \`consolidation.json\` from raw GitHub (with the bundled Pages copy as a fallback). This prevents an old timestamp being misrepresented as the latest audit.

**Do not confuse automatic monitoring with ingestion of all course materials.** External-site checks still read HTML/first-party JavaScript only and save fingerprints rather than republishing third-party questions. GitHub Actions does not have authorisation to read the user's private Drive or ChatGPT conversations, and it cannot perform true academic judgement without a separately authorised private ingestion and review process.

**Publication boundary:** the static question bank is deployed with a reviewed Pages release. For a wholly new question batch created only inside an automated workflow, bot commits to \`questions.js\` might not deploy to Pages; implement and test an explicit Pages deployment or a canonical approved-bank endpoint before allowing autonomous publication of new public questions. The auto-refresh must never claim that an inaccessible private source was ingested or an unreviewed question was independently verified.

When auditing a question, preserve the distinction between original Moodle grading (\`official-key-confirmed\`), evidence traced to the course booklet (\`course_alignment\`) and independent external factual verification (\`verification\`). Only the last is counted as independently verified.
