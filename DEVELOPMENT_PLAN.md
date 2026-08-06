# pkg-compliance — Development Plan

Working codename: `pkg-compliance` (product name TBD — do not invent one).
Source of truth for product decisions: [docs/BRIEF.md](docs/BRIEF.md). Decisions there are settled; raise deltas to Akshay Tandon (product owner & interim regulatory owner). Every corpus change requires his sign-off — hard gate.

**Status: Sprint 0 complete + approved corrections landed. Next: schema-delta decisions, then Batch 1 seeding. Last updated: 2026-08-06.**

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

- [ ] **Gate: resolve [docs/SCHEMA_DELTAS.md](docs/SCHEMA_DELTAS.md) before Batch 1** — 8 gaps found by writing the Exide expected verdicts (checkpoint `subject`, threshold-as-list, BOM-completeness stage, data-integrity findings, N/A scoping note, action-type vocabulary, ID convention)
- [x] Checkpoint schema per §5 of the brief (all fields; versioned data, not code)
- [x] Corpus change workflow: versioned commit + regulatory-owner approval gate (trigger-enforced)

### Batch seeding protocol

Sequenced by certainty, not checklist order. Batches of 10–15 checkpoints, **one commit each**, commit body carrying the checkpoint diff plus the primary-source link per checkpoint — so the approval trail lives in git history alongside the data it approves. Checkpoints land as `draft`; approval rows (with `primary_source_url`) are what promote them to `in_force`.

- [~] **Batch 1 — EU Stack A / PPWR articles.** 10 checkpoints seeded as `draft` (migration `0003_seed-batch1-eu-ppwr.sql`). **Awaiting Akshay's approval** — the seed commit body is the review queue. `citation_verified_date` is NULL on every row: article/paragraph pinpoints were cross-checked against discovery sources but not yet confirmed against the primary enacting text (the EUR-Lex fetch returned only recitals), so each needs a link-click to confirm before promotion. Two deltas were worked around, not resolved: pack/consignment `subject` lives in `notes` (delta #2), and PFAS's three limits are in `requirement_text` with `threshold` NULL (delta #8) — both still need decisions.
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

## Open items / blockers

| Item | Owner | Status |
|---|---|---|
| **[docs/SCHEMA_DELTAS.md](docs/SCHEMA_DELTAS.md) decisions — blocks Batch 1** | Akshay | Pending |
| 2 further real client packs for the golden dataset | Akshay | Pending |
| Kyoto EF access + GreenAlign evidence-flow interface details | Akshay | Pending |
| Product name | Akshay | TBD — use `pkg-compliance` |
