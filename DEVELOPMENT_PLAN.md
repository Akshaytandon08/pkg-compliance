# pkg-compliance — Development Plan

Working codename: `pkg-compliance` (product name TBD — do not invent one).
Source of truth for product decisions: [docs/BRIEF.md](docs/BRIEF.md). Decisions there are settled; raise deltas to Akshay Tandon (product owner & interim regulatory owner). Every corpus change requires his sign-off — hard gate.

**Status: Batch 1 (12) `in_force` under `batch-1`. Sprint 2a + 2b delivered (report loop, guidance, templates). Batch 2 seeded — 17 DRAFT rows (10 EU + 7 India) awaiting approval. Deployment prepared (access gate + migrate-on-deploy); actual deploy needs a Vercel account + managed Postgres. Engine 100% golden agreement. Last updated: 2026-08-11.**

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

- [~] **[docs/SCHEMA_DELTAS.md](docs/SCHEMA_DELTAS.md)** — #2 (checkpoint `subject`) and #8 (thresholds-as-list) **RESOLVED** (migration 0004) plus the eval-format AND/OR gap (CNF evidence). Still open: #3 BOM-completeness stage, #4 data-integrity findings, #5 N/A scoping/assessment-pending, #9 ID convention. (#6 evidence/action vocabularies resolved — `conformity_declaration` added; #7 as-of date already threaded.)
- [x] Checkpoint schema per §5 of the brief (all fields; versioned data, not code)
- [x] Corpus change workflow: versioned commit + regulatory-owner approval gate (trigger-enforced)

### Batch seeding protocol

Sequenced by certainty, not checklist order. Batches of 10–15 checkpoints, **one commit each**, commit body carrying the checkpoint diff plus the primary-source link per checkpoint — so the approval trail lives in git history alongside the data it approves. Checkpoints land as `draft`; approval rows (with `primary_source_url`) are what promote them to `in_force`.

**Approval surface (the regulatory owner's working tools):**
- `npm run corpus:review` — the full draft queue, ordered for one sitting: requirement, thresholds, evidence CNF, applicability, citation pinpoint + primary-source URL.
- `npm run corpus:approve -- --id <id> --version <v> --source-url <url> --approved-by "Akshay Tandon" [--notes]` — records the approval and promotes in one transaction. **Refuses unless `--source-url` is a primary-source domain** (eur-lex.europa.eu / official gazette; extend via `CORPUS_PRIMARY_SOURCE_DOMAINS`).
- `npm run corpus:reject -- --id <id> --version <v> --reason "<why>"` — supersedes a draft with the reason recorded, so the queue empties either way.

- [~] **Batch 1 — EU Stack A / PPWR articles.** Seeded `draft` (migration `0003`), then refactored to the resolved schema (migration `0006`): **11 checkpoints** — `subject` set per row, operator identification split into manufacturer (Art 15(5),(6)) and importer (Art 18(3)) obligations, PFAS thresholds structured, citation pinpoints sharpened. **Awaiting Akshay's approval** — the `0003` and `0006` commit bodies are the review queue. `citation_verified_date` is NULL on every row: pinpoints are "verified via secondary cross-check, confirm on primary" (the EUR-Lex fetch returned only recitals), so each needs a link-click before promotion.
- [~] **Batch 2 — EU (Commit 24) + India (Commit 25).** 17 DRAFT rows. EU: 6 Member-State EPR-registration rows (DE/FR/ES/IT/NL/PL, cite PPWR Art 44; national register names + legal bases TODO), FR Triman/info-tri labelling (Décret 2021-835), EU green-claims (Directive (EU) 2024/825), and the two 2030 forward rows (Art 6/7, thresholds empty pending primary). India: PWM Rules 2016 (as amended) Stack A restrictions + Stack B producer obligations (CPCB); **all numeric values left empty with TODO** (on the §6 re-verify list, not fetchable from primary here). `corpus:review` groups by geography. Awaiting approval — see the enhancement proposals below before approving the MS/India rows.
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

- [x] Deterministic evaluator (`src/lib/engine/evaluate.ts`) — pure core: applicability (`applies_when` incl. `bom_material_present`), CNF evidence matching with document scope + expiry, reason codes, risk. Verdict rule table unchanged.
- [x] Production path (`src/lib/engine/pack.ts`) — DB checkpoints, `in_force`-gated (draft/contested → caveats), component / packaging_unit / organisation aggregation + counts + overall.
- [x] **Harness decoupling** — same engine core, two feed paths; golden-fixture engine tests un-skipped and live (see decision below).
- [x] Report view (`/assessments/[id]/report`) with delta actions from the CNF; screening-only disclaimer persistent.
- [ ] Extraction pipeline (Claude API): BOM/cert/lab-report → structured claims (expiry, NABL/ILAC accreditation, test-method match, cert-covers-this-component). **Not built** — production `designAssessment` defaults to `no_inherent_risk` until it lands, so production verdicts are evidence-driven only.
- [ ] Report generator in Exide-workbook format (export); questionnaire auto-fill (Persona 2a). Not built.
- [ ] Prompts under `/prompts` with eval harness (harness exists; prompts pending extraction).

**Acceptance:** ≥95% checkpoint agreement with the manual assessment. **Current: 100% (17/17)** on the golden fixtures — the one prior miss (client-a line 1 ISPM-15) was a fixture-encoding gap, closed in Commit 17 by modelling the HT/IPPC mark as a `marking` evidence document. Report <10 min from upload: met (evaluation is synchronous, sub-second).

### Harness-decoupling decision (Commit 12)

**Decision:** the eval harness feeds the engine from fixture snapshots (each expected entry embeds its `evidenceRequirements` + `appliesWhen`), independent of the DB; the production path feeds from the DB behind the `in_force` gate. One engine core (`evaluateCheckpoint`), no fork.

**Rationale:** the Sprint 2 acceptance metric must be measurable *before* the regulatory approval pass, but production verdicts must remain `in_force`-only. Coupling the metric to the corpus would have forced a choice between an all-caveats (0%) metric or relaxing the gate for the demo. Decoupling gives a true 94.1% now while the production gate stays untouched — proven reversibly: approving one checkpoint flips its report caveats to verdicts with no code change (`tests/engine-production.test.ts`).

## Sprint 2a — Vertical slice UI (delivered)

- [x] Intake `/assessments/new` — assessment_context + BOM + per-component evidence metadata; persists with corpus version stamped (Commit 13).
- [x] Report `/assessments/[id]/report` — production evaluation, verdict/caveat cards, delta actions (Commit 14).
- [x] List `/`, demo seed (`npm run seed:demo`), empty states, UK spelling (Commit 15).
- [x] Golden fixture fidelity — HT mark modelled as evidence; agreement 100% (Commit 17).
- [x] Manual per-component risk annotation (Commit 18): optional `no_inherent_risk | at_risk` + rationale, attributed to the assessor; the evaluator consumes it as `designAssessment`. Unannotated components default to no_inherent_risk, **rendered explicitly** ("No risk annotation provided"), never silently. The interim bridge until the extraction pipeline lands.

## Sprint 2b — Evidence guidance loop

Turns each gap/conditional into an actionable "how to obtain this" loop.

- [x] **Guidance data model (Commit 21)** — `evidence_guidance` table keyed `(checkpoint_id, checkpoint_version, evidence_type)`: issuer guidance, `must_contain[]`, `red_flags[]`, typical source-org role, cost/turnaround. Same draft→approved discipline as checkpoints (human-only `corpus:approve --guidance`; nothing self-approves). Six rows seeded **draft** for the demo pack's evidence situations, content **derived from the checkpoint records** (thresholds, reference methods, notes), not new research. `corpus:review` lists guidance drafts.
- [ ] **Close the report loop (Commit 22)** — action cards render approved guidance; draft guidance shows as pending; inline "Add evidence" form re-evaluates in place.
- [x] **Request templates (Commit 23)** — downloadable supplier self-declaration and laboratory test requests (`GET /api/assessments/[id]/template`), populated from the checkpoint's threshold, reference method and component details, offered from the action card. **Templates are drafting aids the user sends OUT to their supplier/lab — never system-issued conformity documents; the wording says so, and `tests/report-templates.test.ts` enforces it.**

## Sprint 3 — Stack D + passport + pilot

- [ ] PCF module: mass × material EF + conversion + inbound transport; ISO 14067 cradle-to-gate; data hierarchy (primary supplier → India secondary EF → global proxy) with provenance shown; seed EF library from Fitsol pallet research + bamboo calculator methodology
- [ ] QR → hash-signed tiered-disclosure passport page (public / buyer / audit layers, change-logged)
- [ ] Stack B obligation calendar (renewals, filing deadlines — no fee computation)

**Acceptance:** 3 real client packs end-to-end, ≥1 paying.

## Proposed enhancements (decide before approving the affected Batch 2 rows)

Surfaced by Batch 2; **not improvised into the schema/engine** — proposed here for a decision.

1. **Per-Member-State `applies_when` (contains-semantics).** The MS rows and the FR labelling row should apply *when that Member State is among the destinations* — e.g. `{ "destination_member_states": { "contains": "DE" } }`. The engine currently supports only a literal match or the `"present"` sentinel, so those rows are seeded with `"present"` (applies whenever any destination is set). Proposed: add a `contains` operator to `evaluateApplicability`. Until then, do not rely on per-MS scoping.
2. **Destination-market context field (beyond EU Member States).** India rows apply when the destination market includes India, which `assessment_context` (EU-Member-State-only) does not capture. They are seeded with `applies_when { "destination_market": "IN" }`, an unrecognised key, so the engine returns `CONTEXT_REQUIRED` (safe — never a false pass). Proposed: add `destination_markets: string[]` (e.g. `["EU","IN"]`) to `assessment_context` and to the intake form, and teach the engine the key.
3. **Recurring-obligation "next-due" semantics.** Stack B filing/registration is recurring (annual reports, renewals). Cadence is currently descriptive text in `requirement_text`/`notes` only. Proposed shape: a `recurrence` field on the checkpoint (e.g. `{ "every": "P1Y", "due": "--03-31" }`) plus a per-assessment obligation-calendar view that computes next-due from the as-of date. This is the Stack B "obligation calendar" (brief §3) — worth designing before Stack B is approved and relied upon.

## Corpus monitoring (watch list — review before approving affected checkpoints)

Live regulation moves; these are tracked so a checkpoint is not approved against a stale reading.

- [x] **Commission PPWR FAQ, 2nd edition (DG ENV, Aug 2026).** Ingested — amendments applied to Batch 1 (migration 0009): heavy-metals/soc/PFAS test methods, DoC one-per-unit + MS language, no-transitional-stock softening + Article 71 pinpoint, tech-doc manufacturer-holds-file, FAQ role-derivation rules. FAQ recorded as interpretive only (notes), registered in [docs/regulatory-sources.md](docs/regulatory-sources.md). Rows stay draft; each still needs primary confirmation at approval.
- [ ] **Authorised-representative suspension proposal (Commission, Dec 2025).** Would suspend the AR obligation to 2035 for EU-based companies only; pending, and does **not** affect non-EU producers (persona 2a). Affects `EU-EPR-producer-registration`. Track status; do not weaken the AR requirement for non-EU producers on the strength of a pending proposal.

## Deployment (pilot)

Prepared (Commit "Deploy readiness"); execution needs a Vercel account + a managed Postgres instance.

- **Access gate:** `src/proxy.ts` — HTTP Basic Auth on every route when `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` are set; transparent locally. Client BOM data is never on an open URL.
- **Migrate-on-deploy:** `vercel-build` = `drizzle-kit migrate && next build`.
- **Seed:** `DATABASE_URL="<prod>" node scripts/seed-demo.ts`.
- **Corpus CLIs stay local** — never deployed to any web surface.
- Full steps + env table in [README.md](README.md#deployment-pilot).

| Item | Value |
|---|---|
| Hosted URL | **TBD — record here once deployed** |
| Access method | HTTP Basic Auth (`BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`) |
| Managed Postgres | TBD (Vercel Postgres / Neon / Supabase — any Postgres 16) |

## Open items / blockers

**Sole critical-path blocker: the regulatory approval pass** — 12 draft checkpoints (Batch 1 + ISPM-15) to promote to `in_force` (`--corpus-version batch-1`). Nothing renders a verdict until this runs; the report is all-caveats by design until then. **Webinar dependency: the demo needs an approved corpus by ~20 Aug 2026** — the report shows verdicts only once checkpoints are in force. The 12 ready-to-paste `corpus:approve` commands are below.

| Item | Owner | Status |
|---|---|---|
| **Run the 12-row approval pass (`corpus:review` → the 12 commands below); confirm each pinpoint on primary — esp. no-transitional-stock Art 71, ISPM revision + Reg (EU) 2016/2031** | Akshay | **Pending — blocks the demo (~20 Aug)** |
| Remaining [docs/SCHEMA_DELTAS.md](docs/SCHEMA_DELTAS.md) decisions (#3, #4, #5, #9) | Akshay | Pending |
| Extraction pipeline (Claude API) — interim: manual per-component risk annotation bridges `designAssessment`; extraction would populate it automatically | — | Sprint 2 remainder |
| 2 further real client packs for the golden dataset | Akshay | Pending |
| Kyoto EF access + GreenAlign evidence-flow interface details | Akshay | Pending |
| Product name | Akshay | TBD — use `pkg-compliance` |

### Batch 1 + ISPM-15 approval pass — ready to paste

Review first with `npm run corpus:review`, click each source, then run the matching command. All are version 1, corpus version `batch-1`.

```bash
npm run corpus:approve -- --id EU-PPWR-heavy-metals --version 1 --source-url "https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng" --approved-by "Akshay Tandon" --corpus-version batch-1
npm run corpus:approve -- --id EU-PPWR-pfas-food-contact --version 1 --source-url "https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng" --approved-by "Akshay Tandon" --corpus-version batch-1
npm run corpus:approve -- --id EU-PPWR-soc-minimisation --version 1 --source-url "https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng" --approved-by "Akshay Tandon" --corpus-version batch-1
npm run corpus:approve -- --id EU-PPWR-no-chemical-preservative --version 1 --source-url "https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng" --approved-by "Akshay Tandon" --corpus-version batch-1
npm run corpus:approve -- --id EU-PPWR-composite-plastic-relevant --version 1 --source-url "https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng" --approved-by "Akshay Tandon" --corpus-version batch-1
npm run corpus:approve -- --id EU-PPWR-technical-documentation --version 1 --source-url "https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng" --approved-by "Akshay Tandon" --corpus-version batch-1
npm run corpus:approve -- --id EU-PPWR-declaration-of-conformity --version 1 --source-url "https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng" --approved-by "Akshay Tandon" --corpus-version batch-1
npm run corpus:approve -- --id EU-PPWR-operator-id-manufacturer --version 1 --source-url "https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng" --approved-by "Akshay Tandon" --corpus-version batch-1
npm run corpus:approve -- --id EU-PPWR-operator-id-importer --version 1 --source-url "https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng" --approved-by "Akshay Tandon" --corpus-version batch-1
npm run corpus:approve -- --id EU-PPWR-no-transitional-stock --version 1 --source-url "https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng" --approved-by "Akshay Tandon" --corpus-version batch-1
npm run corpus:approve -- --id EU-EPR-producer-registration --version 1 --source-url "https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng" --approved-by "Akshay Tandon" --corpus-version batch-1
npm run corpus:approve -- --id INTL-ISPM15-heat-treatment --version 1 --source-url "https://www.ippc.int/en/core-activities/standards-setting/ispms/" --approved-by "Akshay Tandon" --corpus-version batch-1
```
