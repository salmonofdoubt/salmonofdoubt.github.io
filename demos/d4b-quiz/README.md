# D4B Evidence Quiz | Evidence pipeline

Built on the existing \`demos/demo-template/\` scaffold. The public question bank and the local personal-study bank have separate trust boundaries.

## Source registry and permitted capabilities

| Source | Current actual capability | Private data published? |
| --- | --- | --- |
| Digital Leprechaun | Public HTML availability and SHA-256 fingerprint only | No |
| Get Styled D4B | Public HTML availability and SHA-256 fingerprint only | No |
| User's Google Drive | Requires an authenticated private connector or authorised export | No |
| ChatGPT quiz conversations | Requires a user-controlled export or private extraction | No |

**A successful source check does not mean that questions were ingested.** Neither public quiz site currently provides a validated ingestion contract. The initial 55 questions are booklet-derived; their source markers do not certify their factual correctness.

## Refresh from the website

Click **Refresh via GitHub**. The site opens the GitHub Actions workflow. Sign in and select **Run workflow**, with the default branch selected. Return to the quiz page. The progress panel uses real GitHub Actions step states; **Check status** updates it on demand.

The workflow performs the following steps:

1. Check public-source availability; record checksums, response sizes, connection errors and explicit private-source connection limits. It never commits fetched question text.
2. Audit public question-bank schema, IDs, answer indexes, provenance fields and evidence-gated verification states.
3. Consolidate a public, machine-readable report. Record \`last_checked_at\`, \`last_consolidated_at\`, and \`last_question_bank_change_at\` as distinct timestamps.
4. Commit only the safe metadata files \`source-check.json\`, \`audit-report.json\` and \`consolidation.json\`. On a bad structural audit the workflow fails and the published report remains unchanged.

An external fetch failure appears as **unavailable**, not "checked and ingested". Manual workflow triggering cannot securely be replaced by an unauthenticated public browser button. A true one-click trigger would require an authenticated service, for example a Cloudflare Access-protected Worker and server-side GitHub workflow token.

## Verification policy

\`verification="pending"\`: not independently fact-checked. \`verification="flagged"\`: known ambiguity or contradiction requiring review. \`verification="verified"\`: allowed only with \`evidence.originalMaterialChecked=true\`, a source \`locator\`, and \`reviewed_at\`. A confirmed Moodle answer key on its own is not independent verification.

The workflow checks *structural consistency*, not semantic truth. Indepedent review of the original academic sources and near-miss answer options remains necessary. Never present a question as verified merely because schema tests pass.

## Private Moodle import

The existing private-import control in the quiz takes a local JSON file with original Moodle question text, choices and recorded answer key. It stores that information in browser \`localStorage\` only. It is not synced across devices and disappears if browser site storage is cleared. Do not upload private Moodle records to this public GitHub repository.

## Operations and regression checks

- First run: merge the PR so the new workflow exists on the default branch; then use GitHub Actions to run it.
- PR changes automatically run the audit workflow without publishing reports to the branch.
- JS source and manifest must be cache-busted on every change; increase the scoped PWA cache.
- Desktop and mobile: test the refresh panel, large-text wrapping, touch targets, install button, fixed DOI floater, accessibility labels, question selection, scored review, timer, private import, history persistence and offline fallback.
- Do not delete the existing progress localStorage key; stable question IDs preserve history.
- For publication of new public questions, change \`questions.js\` through reviewed GitHub changes and update its cache version. Private sources must not be committed.

## Remaining engineering work

- Legitimate external question-feed access and reuse review for both peer sites.
- Authorised private Drive ingestion and change detection.
- ChatGPT export processing or another consent-based archive interface.
- An actual semantic answer-audit queue with per-question evidence signatures and human review.
- Optional direct one-click authenticated trigger once the operator elects to configure server-side credentials.
