# pkg-compliance — Development Plan

Working codename: `pkg-compliance` (product name TBD — do not invent one).
Source of truth for product decisions: [docs/BRIEF.md](docs/BRIEF.md). Decisions there are settled; raise deltas to Akshay Tandon (product owner & interim regulatory owner). Every corpus change requires his sign-off — hard gate.

**Status: Batch 1 (11 draft checkpoints) ready for regulatory approval via `npm run corpus:review`/`:approve`/`:reject`. Schema deltas #2/#8 and the organisation-subject gap resolved (fixture format v3, `assessment_context` + `applies_when`). Next: Akshay's Batch 1 pass, then Batch 2. Last updated: 2026-08-10.**

## Hard constraints (enforce in code, verify in review)

1. The system must never present itself as issuer, certifier or verifier. It **may and must** state legal terminology precisely — checkpoint text saying "issue a DoC per Annex VIII", delta actions telling users to compile one, questionnaire fill referencing certifications the client holds are all correct. What is forbidden is first-person issuing language ("we certify", "this report certifies", "is hereby certified") and the phrases "audit-grade" / "verified PCF". Enforced at output level by `tests/report-language.test.ts`; `npm run check:language` is only a cheap tripwire over source.
2. LLM extracts only; pass/fail is deterministic rule evaluation (`src/lib/engine/verdict.ts` is the single place a verdict is decided).
3. `contested` status or missing primary citation → visible caveat in rendered reports, never a verdict.
4. A checkpoint without an article-level primary citation cannot ship, **and** cannot reach `in_force` without a regulatory-owner approval record. Both halves enforced: DB trigger (`drizzle/0001_approval-trigger.sql`) and application guard (`src/lib/corpus/evaluability.ts`). Approved content is immutable — substantive edits require a new version, hence fresh sign-off.
5. Persona ≠ legal role. Role is derived per transaction; ambiguous derivation → flag for legal confirmation, never silently assign.
6. Reports record the corpus version **and the as-of date** used (reproducibility — forward flags are date-relative).
7. British spelling in all user-facing output.

## Scope (binding)

- Geographies: EU + India only.
- Materials: corrugated, plastics, wood in full; metal = single CBAM-flag rule.
- Stacks: A complete; B calendar-only; C static signed passport page; D screening-grade PCF.
- Non-goals: US/Middle East rules, fee optimiser, multi-tenancy polish, auth beyond basic, Greenfind integration, and any output in which the system itself issues, certifies or verifies (see constraint 1 — instructing users about *their* DoC obligations is in scope and required).

## Tech decisions

- Next.js 16 + PostgreSQL 16, Drizzle ORM (SQL-first migrations). Noted convention delta vs the Fitsol Asset Classification Directory — settled, not revisiting.
- Checkpoints are versioned data in DB; corpus changes via migration-versioned commits.
- Claude API for extraction, structured-output prompts in `/prompts`, eval harness against golden dataset — model/prompt changes must not silently change verdicts.
- Integrations: GreenAlign (supplier evidence), Kyoto (emission factors).

## Sprint 0 — Repo setup (complete)

- [x] Ingest brief → `docs/BRIEF.md`
- [x] Development plan (this file)
- [x] Git repo initialised, initial commit
- [x] Three reference artefacts received into `/reference` (2026-08-06; sheet structure verified against brief §8)
- [x] Scaffold: Next.js 16 (App Router, TS, Tailwind) + Postgres 16 (Docker, host port 5433 — 5432 is taken by `asset-directory-db`) + Drizzle ORM with SQL migrations. Checkpoint + corpus_versions schema per brief §5.
- [x] Drizzle confirmed (noted delta vs Asset Classification Directory conventions; SQL-first migrations fit the versioned-corpus rule — not revisiting)
- [x] **Correction 1** — language guardrail moved to the output layer. Lexical check narrowed to first-person issuing claims so the corpus can state legal terminology precisely; real enforcement is golden-report assertions in `tests/report-language.test.ts`.
- [x] **Correction 2** — approval gate made structural: `draft` insert state, `checkpoint_approvals` table (`approved_by`, `approved_at`, `corpus_version_id`, `primary_source_url`), DB trigger blocking unapproved `in_force` and freezing approved content, plus `evaluability()` refusing to evaluate anything not in force. Verified against live Postgres in `tests/db/approval-gate.test.ts`.
- [x] **Correction 3** — eval harness scaffolded ahead of the corpus: Exide golden fixtures + `npm test` wired into `npm run check`. Surfaced 8 schema gaps → [docs/SCHEMA_DELTAS.md](docs/SCHEMA_DELTAS.md), awaiting decision before Batch 1.

## Sprint 1 — Corpus + schema

- [~] **[docs/SCHEMA_DELTAS.md](docs/SCHEMA_DELTAS.md)** — #2 (checkpoint `subject`) and #8 (thresholds-as-list) **RESOLVED** (migration 0004) plus the eval-format AND/OR gap (CNF evidence). Still open: #3 BOM-completeness stage, #4 data-integrity findings, #5 N/A scoping/assessment-pending, #6 action-type vocabulary, #7 (as-of date — already threaded), #9 ID convention.
- [x] Checkpoint schema per §5 of the brief (all fields; versioned data, not code)
- [x] Corpus change workflow: versioned commit + regulatory-owner approval gate (trigger-enforced)

### Batch seeding protocol

Sequenced by certainty, not checklist order. Batches of 10–15 checkpoints, **one commit each**, commit body carrying the checkpoint diff plus the primary-source link per checkpoint — so the approval trail lives in git history alongside the data it approves. Checkpoints land as `draft`; approval rows (with `primary_source_url`) are what promote them to `in_force`.

**Approval surface (the regulatory owner's working tools):**
- `npm run corpus:review` — the full draft queue, ordered for one sitting: requirement, thresholds, evidence CNF, applicability, citation pinpoint + primary-source URL.
- `npm run corpus:approve -- --id <id> --version <v> --source-url <url> --approved-by "Akshay Tandon" [--notes]` — records the approval and promotes in one transaction. **Refuses unless `--source-url` is a primary-source domain** (eur-lex.europa.eu / official gazette; extend via `CORPUS_PRIMARY_SOURCE_DOMAINS`).
- `npm run corpus:reject -- --id <id> --version <v> --reason "<why>"` — supersedes a draft with the reason recorded, so the queue empties either way.

- [~] **Batch 1 — EU Stack A / PPWR articles.** Seeded `draft` (migration `0003`), then refactored to the resolved schema (migration `0006`): **11 checkpoints** — `subject` set per row, operator identification split into manufacturer (Art 15(5),(6)) and importer (Art 18(3)) obligations, PFAS thresholds structured, citation pinpoints sharpened. **Awaiting Akshay's approval** — the `0003` and `0006` commit bodies are the review queue. `citation_verified_date` is NULL on every row: pinpoints are "verified via secondary cross-check, confirm on primary" (the EUR-Lex fetch returned only recitals), so each needs a link-click before promotion.
- [ ] **Batch 2 — EU Stack B/C.** EPR calendar, labelling, claims.
- [ ] **Batch 3 — India.** Slowest review: every value comes off the §6 re-verify list. Each checkpoint attaches the CPCB notification / gazette PDF link — never a consultancy summary.
- [ ] Seed to ~60–80 EU+India checkpoints total from the two reference artefacts
- [ ] Re-cite every rule to primary law (EUR-Lex / CPCB / gazette, article level)
- [ ] Clear the §6 re-verify list from primary sources (do NOT trust conversation values):
  - India recycled-content % and category-wise EPR targets (CPCB notifications)
  - TPCH state count
  - EU harmonised-labelling act timing
  - Italy plastic tax status
  - CN 7317 (nails) CBAM status
  - PPWR 2030 numbers: 70% recyclability floor, grade dates, Art. 29 40% transport reuse target (EUR-Lex direct)
- [x] Golden dataset: traction-cell BOM (7 components + 2 photo-gap) with known verdicts — `eval/fixtures/client-a-traction-cell.json` (anonymised); eval harness in `eval/` (`golden-fixtures.test.ts` active, `engine-verdicts.test.ts` skipped until the engine lands)
- [ ] Golden dataset: 2 more real packs (needs client packs from Akshay)

## Sprint 2 — Engine

- [ ] Extraction pipeline (Claude API): BOM/cert/lab-report → structured claims (expiry, NABL/ILAC lab accreditation, test-method match, cert-covers-this-component)
- [ ] Deterministic evaluator (Qualified / Conditional / Gap per component per checkpoint, with delta actions)
- [ ] Report generator in Exide-workbook format
- [ ] Questionnaire auto-fill (Persona 2a flow, template artefact as target format)
- [ ] Eval harness in repo, prompts under `/prompts`

**Acceptance:** ≥95% checkpoint agreement with manual Exide assessment; report <10 min from upload.

## Sprint 3 — Stack D + passport + pilot

- [ ] PCF module: mass × material EF + conversion + inbound transport; ISO 14067 cradle-to-gate; data hierarchy (primary supplier → India secondary EF → global proxy) with provenance shown; seed EF library from Fitsol pallet research + bamboo calculator methodology
- [ ] QR → hash-signed tiered-disclosure passport page (public / buyer / audit layers, change-logged)
- [ ] Stack B obligation calendar (renewals, filing deadlines — no fee computation)

**Acceptance:** 3 real client packs end-to-end, ≥1 paying.

## Corpus monitoring (watch list — review before approving affected checkpoints)

Live regulation moves; these are tracked so a checkpoint is not approved against a stale reading.

- [x] **Commission PPWR FAQ, 2nd edition (DG ENV, Aug 2026).** Ingested — amendments applied to Batch 1 (migration 0009): heavy-metals/soc/PFAS test methods, DoC one-per-unit + MS language, no-transitional-stock softening + Article 71 pinpoint, tech-doc manufacturer-holds-file, FAQ role-derivation rules. FAQ recorded as interpretive only (notes), registered in [docs/regulatory-sources.md](docs/regulatory-sources.md). Rows stay draft; each still needs primary confirmation at approval.
- [ ] **Authorised-representative suspension proposal (Commission, Dec 2025).** Would suspend the AR obligation to 2035 for EU-based companies only; pending, and does **not** affect non-EU producers (persona 2a). Affects `EU-EPR-producer-registration`. Track status; do not weaken the AR requirement for non-EU producers on the strength of a pending proposal.

## Open items / blockers

| Item | Owner | Status |
|---|---|---|
| Approve/promote the 11 Batch 1 drafts via `corpus:review`/`:approve` (confirm pinpoints on primary; pin the no-transitional-stock article) | Akshay | Pending |
| Remaining [docs/SCHEMA_DELTAS.md](docs/SCHEMA_DELTAS.md) decisions (#3, #4, #5, #6, #9) | Akshay | Pending |
| 2 further real client packs for the golden dataset | Akshay | Pending |
| Kyoto EF access + GreenAlign evidence-flow interface details | Akshay | Pending |
| Product name | Akshay | TBD — use `pkg-compliance` |
