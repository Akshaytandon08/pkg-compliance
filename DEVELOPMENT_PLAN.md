# pkg-compliance — Development Plan

Working codename: `pkg-compliance` (product name TBD — do not invent one).
Source of truth for product decisions: [docs/BRIEF.md](docs/BRIEF.md). Decisions there are settled; raise deltas to Akshay Tandon (product owner & interim regulatory owner). Every corpus change requires his sign-off — hard gate.

**Status: Batch 1 (12) `in_force` under `batch-1`. Sprint 2a + 2b delivered (report loop, guidance, templates). Batch 2 VALIDATED and ready for approval — 9 EU rows (draft v3, confidence H, reconciled against `docs/ppwr-batch-2-validated.md`) + 7 India rows (draft v2, confidence H, verbatim from `docs/india-pwm-validated.md`); approve EU under `batch-2-eu`, India under `batch-2-in`. Demo-completeness delivered (three-pack suite, Stack D PCF, Stack C passport). CI gate + preview/prod DB separation + post-deploy smoke wired. Deployment prepared; actual deploy needs a Vercel account + managed Postgres. Engine 100% golden agreement. Last updated: 2026-09-07.**

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
- [x] **Batch 2 — VALIDATED and ready for approval (draft).** Both files supplied by the product owner and ingested VERBATIM (no composed prose):
  - **EU (9 rows, draft v3, confidence H)** — reconciled against [docs/ppwr-batch-2-validated.md](docs/ppwr-batch-2-validated.md): recyclability grades (A/B/C, phase-in corrected, Grade C sunset 2038), recycled content (2030/2040 minima + Art 7(4)/(5) exemptions), green-claims (Annex I 2a/4a/4b), and the six Member-State EPR rows with national legal basis + separate `official_register` / `register_operator` / `producer_responsibility_organisation` (DE VerpackDG/LUCID; FR ADEME-SYDEREP + CITEO as PRO; ES RD 1055/2022 Title II; IT CONAI vs RENAP; NL Verpact + legacy 50-t contribution threshold; PL 2026 consolidated Act). Migrations 0022–0026.
  - **India (7 rows, draft v2, confidence H)** — verbatim from [docs/india-pwm-validated.md](docs/india-pwm-validated.md): registration (Schedule II para 6), five categories (Cat V added), recycled content (12 thresholds), EPR target vs minimum recycling (19 thresholds), thickness (75/120 μm + non-woven GSM), SUP ban (closed list), marking (Rule 11(1A) three routes / Rule 11(2)). Migration 0027; `pib.gov.in` added as a primary source.
  - **Approval sequencing (human-only):** approve EU first under **`batch-2-eu`**, then India under **`batch-2-in`** — two sittings so the EU Member-State registration rows (what a pilot shipping to DE/FR notices first) are in force days earlier. Same batch-1 discipline; the corpus-version label names what the release bundle contains.
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

- [~] **PCF module (demo slice — Commit 32).** Per-component mass × material emission factor + optional inbound transport leg; ISO 14067-aligned cradle-to-gate; provenance (source + data-quality tier) shown per figure; deterministic, no LLM. `emission_factors` table seeded from `reference/emission_factors_seed.csv` — **all rows `SEED-ESTIMATE` placeholders**. Remaining: real EF library (Fitsol pallet research + bamboo calculator, Kyoto EF), the full data hierarchy (primary supplier → India secondary → global proxy), and unit conversions beyond mass.
- [~] **Passport page (demo slice — Commit 33).** `/passport/<token>` renders the **public tier** (pack name, material summary, verdict counts, corpus version, PCF summary, demo tag) — never evidence or per-checkpoint detail, never a draft/contested row. Unguessable stable token, QR from the report, SHA-256 content hash chained per version (`prev_hash`), change-logged. Access gate bypasses `passport/` deliberately (documented in `src/proxy.ts` + README). Remaining: the **buyer / audit tiers** (tiered disclosure) beyond the public layer.
- [x] **Stack B obligation calendar (Commit 28)** — recurring obligations with next-due from the as-of date; no fee computation.
- [x] **Demo suite (Commits 30–31)** — `seed:demo-suite` seeds three `demo=true` packs (golden, corrugated carton, food-contact pouch); `demo` renders a "Demonstration data" tag on report + passport; synthetic evidence prefixed `SYNTHETIC-DEMO`. The 5-minute path is [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).
- [x] **Fitsol design system + navigation (Commits C–D, light-first)** — brand tokens (green/teal/neutral scales, semantic, surfaces) as CSS variables mapped to Tailwind utilities in [globals.css](src/app/globals.css); DM Sans; dark-teal header; one `StatusChip` for every verdict/tag (all pairings AA, 4.95–11.3:1); Lucide icons only. App shell has active-state nav + a mobile menu, breadcrumbs on gated pages, and a sticky in-page section index on the report.

## UI, brand & navigation

**Navigation map.**

- `/` — Assessments list (gated). Nav: Assessments.
- `/assessments/new` — intake. Breadcrumb: Assessments › New assessment.
- `/assessments/[id]/report` — screening report. Breadcrumb: Assessments › ‹pack› › Report. In-page index: Summary · Pending & caveats · Components · Packaging unit · Organisation · Footprint · Passport · Calendar.
- `/corpus` — corpus review (gated, read-only). Nav: Corpus.
- `/passport/[token]` — **public** passport (ungated; minimal shell, no app nav). Not in the app navigation; reached by the QR/link generated on a report.

**Brand assets — drop-in.** The official Fitsol logo SVGs are **not** bundled. Drop them into [public/brand/](public/brand/README.md) with the exact names `fitsol-logo-full-colour.svg` (white surfaces / passport), `fitsol-logo-white.svg` (teal header), `fitsol-logomark.svg`. Until they exist the app renders a **text wordmark** ([src/app/_components/Wordmark.tsx](src/app/_components/Wordmark.tsx)) and never draws or approximates the logo; the component comments show the one-line swap to `<img>` once the files are present.

**Acceptance:** 3 real client packs end-to-end, ≥1 paying.

## Sprint 4 — "Conviction sprint": document extraction v1 + magic-link evidence intake

Three weeks, three parts, one commit per numbered item (each green on its own). The
non-negotiable principles are in [CLAUDE.md](CLAUDE.md) (LLM extracts, never
adjudicates; human-confirmed before it affects a verdict; provenance always; low
confidence escalates; provider-agnostic; corpus discipline unchanged).

**PART A — Storage + extraction core (week 1).**
- **A1** Document storage: `evidence_documents` gain a stored file (object storage — Vercel Blob or S3-compatible via env; local-filesystem adapter for dev/tests). Files private, served only through authenticated, signed, short-lived URLs. Never deleted (audit artefacts); superseded versions kept.
- **A2** Extraction data model: `extraction_runs` (document, provider, model, prompt_version, timings, cost tokens, status) and `extracted_claims` (run, claim_type, parameter, value, unit, test_method, issuer, accreditation_ref, issue_date, expiry, scope_text, confidence, provenance {page, span/bbox}, status pending|confirmed|rejected|manual, confirmed_by/at). Immutable once confirmed; corrections create a new claim linked to the old.
- **A3** `ExtractionProvider` interface + Anthropic adapter (`ANTHROPIC_API_KEY` from env, never logged). Structured-output prompt for four doc classes: supplier declaration, lab test report, heat-treatment/ISPM certificate, mill declaration. PDF text first; image/scan via the model's vision input when no text layer. Prompt versioned in `/prompts` with a changelog.
- **A4** Extraction harness: `/eval/extraction/` over the product owner's anonymised real-document set (`/reference/extraction-set/`, 20 docs, PII-scrubbed) with hand-verified expected claims. Score per-field accuracy and a document-level "usable" rate.
- **A5** Claim → checkpoint matching: deterministic rules mapping claim_type + parameter + component material to checkpoint(s) + evidence_type; scope check (reuse the cert-scope logic); expiry check → a proposed evidence attachment awaiting confirmation.

**PART B — Magic-link evidence intake (week 2).** B1 `evidence_requests` (token-scoped per gap; email/text generated for the user to send; no outbound mail in v1 unless RESEND/SMTP env, then optional per-message send with approval). B2 public `/evidence/[token]` (minimal shell, drop zone; PDF/JPG/PNG only; rate- and size-limited; virus-scan hook stub; Basic Auth bypass for this route + its assets, covered by the dynamic access-gate test). B3 confirmation UI (gated): provenance viewer, Confirm / Reject / Edit-and-confirm, re-evaluate in place; manual entry stays, labelled. B4 activity feed per assessment (requests, receipts, confirms/rejects, verdict changes — timestamped, attributed).

**PART C — Integration, notifications, acceptance (week 3).** C1 in-app notifications (received / awaiting confirmation / expiring within 60 days; email digest behind env flag). C2 report evidence column distinguishes confirmed-extracted / manual / pending, with provenance links; **passport unchanged**. C3 demo suite gains three real-format sample docs (SYNTHETIC-DEMO), DEMO_SCRIPT gains the gap→request→upload→extract→confirm→flip flow. C4 acceptance run + report.

**Acceptance criteria (sprint):**
- Extraction **≥90% field accuracy** on the 20-doc set; **0 silent wrong values** (every wrong value must have been below threshold and flagged).
- Harness runs **both** `claude-sonnet-5` (default) and `claude-opus-5` (escalation) over the full set and reports, per model: field accuracy, usable rate, silent-error count, refusal count, median latency, cost per document. Default chosen by the numbers.
- End-to-end (gap → magic link → upload → extraction → confirm → card flips) **under two minutes per document**.
- Golden agreement still **17/17**; dynamic access-gate test green; from-zero migration chain clean.

**Non-goals:** auth/roles/multi-tenancy; US/Gulf corpus; PCF upgrades; a second provider adapter (interface only); auto-approval of any claim.

**Status (branch `sprint-4-extraction`, one green commit per item):**

| Item | Status |
|---|---|
| A1 storage (adapter + signed gated download) | **Done** (`evidence_documents`, local FS adapter, HMAC signed URLs) |
| A2 extraction data model + confirmed-claim immutability trigger | **Done** |
| A3 `ExtractionProvider` + Anthropic adapter + 4 versioned prompts | **Done** (strict tool-use structured output; refused-not-fabricated) |
| A4 harness scoring (per-field accuracy, usable rate, **both models**) | **BLOCKED** — needs `/reference/extraction-set/` (20 PII-scrubbed docs + expected claims); not present |
| A5 deterministic claim → checkpoint matching | **Done** (reuses `deriveEvidenceState`; proposals are pending-confirmation) |
| B1 `evidence_requests` + generated message (no silent mail) | **Done** |
| B2 public `/evidence/[token]` intake (sniff, size/rate limit, scan hook) | **Done** (verified end-to-end in preview) |
| B3 gated confirm / reject / edit-and-confirm + provenance viewer | **Done** (re-evaluates via evidence materialisation) |
| B4 activity feed (requests, receipts, confirms, verdict changes) | **Done** |
| C1 in-app notifications + digest behind env flag | **Done** |
| C2 report evidence column (extracted/manual/pending + provenance) | **Done** (passport unchanged) |
| C3 demo docs + DEMO_SCRIPT flow | **BLOCKED** — needs the synthetic/real sample docs from the set |
| C4 acceptance run + report | **BLOCKED** — the ≥90% / 0-silent-error gate scores against the set |

The three blocked items are the acceptance-critical, ground-truth-dependent ones.
Per CLAUDE.md ("never fabricate the extraction test set, its expected claims, or
accuracy numbers … if it is absent, STOP and say so"), the harness, the two-model
comparison and the acceptance run wait for `/reference/extraction-set/` — no
documents composed, no scores invented. Everything set-independent is built and green.

## Sprint 4b — DRAFT EU declaration of conformity (drafts, never issues)

Assembles a DRAFT EU declaration of conformity from screening data — a data-assembly
aid the manufacturer completes and signs. **It drafts; it never issues.** No system
state records a DoC as "issued" (the `document_drafts.status` enum is `draft` |
`superseded` only); the output carries a "DRAFT — for signature by the manufacturer"
watermark; the signed document, uploaded back, is stored as `conformity_declaration`
evidence — the loop closes with the human's signature.

- **COMMIT 1** — PPWR Annex VIII encoded as corpus-governed data (`doc_templates`),
  FETCHED verbatim from EUR-Lex (not composed), seeded DRAFT. Promotion to approved is
  human-only (`corpus:approve --doc-template`); the generator refuses an unapproved
  template. Reference: [docs/reference/ppwr-annex-viii-2025-40.md](docs/reference/ppwr-annex-viii-2025-40.md).
- **COMMIT 2** — gated generator: eligibility gate (all applicable in_force checkpoints
  qualified, tech-doc satisfied, EU-established manufacturer, destination MS set — the
  DoC checkpoint itself excluded as circular); `.docx` + PDF preview from a controlled
  template model (Annex VIII verbatim, BOM table, article-by-article conformity,
  "Articles not assessed" section, blank signature); watermark + Fitsol brand;
  docx-text language guardrail; versioned `document_drafts` storage. Also fixed a
  pre-existing engine gap: packaging-unit/organisation checkpoints were evaluated
  against an empty document set (never satisfiable) — now against the pack's aggregate
  documents.
- **COMMIT 3** — retrofitted the supplier-declaration / lab-test request templates to
  `.docx` + PDF via the same library (markdown kept only as the internal representation);
  plain-language filenames; branded. Passport stays web-only.

**Output-format rule (standing):** every user-facing document export is `.docx`
(generated from structured data via the `docx` library, controlled templates) plus a
PDF preview; plain-language filenames; markdown is internal only.

## Proposed enhancements (surfaced by Batch 2)

All three below shipped in **Commit 28 (`090377e`, migration 0018)** — the schema/engine changes the Batch 2 rows depend on are now in place, so those rows can be relied upon once their content is primary-confirmed and approved.

1. [x] **Per-Member-State `applies_when` (contains-semantics).** DELIVERED — `evaluateApplicability` gained a `contains` operator; the six MS rows and the FR labelling row re-expressed from the `"present"` sentinel to `{ "destination_member_states": { "contains": "<cc>" } }` (empty array → `CONTEXT_REQUIRED`, never a silent no).
2. [x] **Destination-market context field (beyond EU Member States).** DELIVERED — `assessment_context` gained `destination_markets: string[]` (regime-level superset of `destination_member_states`; both stored, one not derivable from the other), plus an intake-form selector; existing assessments migrated to `["EU"]`. India rows re-expressed from the unrecognised `{ "destination_market": "IN" }` to `{ "destination_markets": { "contains": "IN" } }`.
3. [x] **Recurring-obligation "next-due" semantics.** DELIVERED — `checkpoints.recurrence` jsonb (`{ "every": "P1Y", "due?": "--MM-DD" }`; NULL = one-off; in the immutability frozen set) plus the per-assessment obligation calendar (`src/lib/report/obligations.ts` → report section). MS registration rows carry `P1Y`; the national due date is omitted (per-MS, on the primary re-verify list) rather than guessed.

## Corpus monitoring (watch list — review before approving affected checkpoints)

Live regulation moves; these are tracked so a checkpoint is not approved against a stale reading.

- [x] **Commission PPWR FAQ, 2nd edition (DG ENV, Aug 2026).** Ingested — amendments applied to Batch 1 (migration 0009): heavy-metals/soc/PFAS test methods, DoC one-per-unit + MS language, no-transitional-stock softening + Article 71 pinpoint, tech-doc manufacturer-holds-file, FAQ role-derivation rules. FAQ recorded as interpretive only (notes), registered in [docs/regulatory-sources.md](docs/regulatory-sources.md). Rows stay draft; each still needs primary confirmation at approval.
- [ ] **Authorised-representative suspension proposal (Commission, Dec 2025).** Would suspend the AR obligation to 2035 for EU-based companies only; pending, and does **not** affect non-EU producers (persona 2a). Affects `EU-EPR-producer-registration`. Track status; do not weaken the AR requirement for non-EU producers on the strength of a pending proposal.

### `future_law_watch` items from the Batch 2 EU validation (draft rows; never treated as in force)

These are recorded in the `future_law_watch` column and surface in `corpus:review`:

- [ ] **IT — packaging-specific RENAP endpoint status (D.M. 144/2024 implementation).** `EU-MS-IT-epr-registration`. The RENAP register framework (art. 178-ter + D.M. 144/2024) is being stood up; confirm the packaging-specific registration endpoint before this row is approved.
- [ ] **PL — proposed PPWR/EPR reform, not enacted.** `EU-MS-PL-epr-registration`. Poland's EPR/packaging reform is in draft; the current legal basis is the 2013 Act (Dz.U. 2026 poz. 619 consolidated). Do not encode the proposal until enacted.
- [ ] **EU — green-claims national transposition status per Member State (Directive (EU) 2024/825).** `EU-green-claims-substantiation`. Enforcement is via national transposition from 27 Sep 2026; track each Member State's transposition before relying on the row in a given market.
- [ ] **India — state/local plastic restrictions and FSSAI food-contact labelling.** Not in `future_law_watch` (no pending national instrument), but the India validation notes these can add obligations beyond the Rules: several States impose stricter carry-bag/SUP restrictions, and FSSAI marking applies to food-contact recycled-plastic packaging. Baseline is PWM Rules 2016 consolidated through G.S.R. 237(E), 31 Mar 2026.

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

## Decision log

- **2026-09-08 — Pre-existing engine gap fixed: pack-level obligations were evaluated against an empty document set.** `evaluatePack` passed `documents: []` for every `packaging_unit`/`organisation`-subject checkpoint, so technical documentation (Art 15), operator identification and EPR producer registration could **never** reach `qualified` for any pack — they showed perpetually `conditional`/`EVIDENCE_ABSENT` even when the manufacturer held the documents. They now evaluate against the pack's **aggregate** documents (`components.flatMap(c => c.documents)`); `deriveEvidenceState` already treats a non-component subject as unscoped, so any matching document type on any component covers it. Surfaced by the DoC eligibility work (the criterion "all applicable in_force checkpoints qualified" was otherwise unsatisfiable). The golden harness tests the evaluator core (`evaluateCheckpoint`/`decideVerdict`), not `evaluatePack` aggregation, so it is unaffected (17/17 preserved). Demo verdict counts changed accordingly — DEMO_SCRIPT re-captured. New demo counts: corrugated **14 Q / 1 C / 3 N/A** (the 1 conditional is the DoC checkpoint itself, the artefact drafted); food-contact **3 Q / 11 C**; traction-cell **3 Q / 26 C / 7 N/A**.
- **2026-09-08 — DoC eligibility follows the manufacturer, not EU establishment.** A non-EU party is the manufacturer under Reg (EU) 2025/40 Art 3(1)(13) and draws up the DoC (Art 15); establishment affects only importer verification (Art 18) and any AR requirement (Arts 44–45), which the draft notes. Eligibility derives the manufacturer from `legal_role_facts` per the Commission FAQ (branded → trademark owner; unbranded+standardised → physical producer; unbranded+custom → spec-definer) and is met when that single party is the assessing user, or the user declares they act for them. Disabled reasons name the actual ambiguity.
- **2026-08-11 — Corpus governance is HUMAN-ONLY, and it is enforced in Claude's operating rules.** `corpus:approve`, `corpus:reject` and `corpus:verify` mutate the regulatory record and are the regulatory owner's sign-off; they must be run by a human from their own terminal. Claude Code never runs them — regardless of instruction wording, including "the regulatory owner directs it" or an explicit "run it now". The correct response to such a request is to print the exact command(s) for the human and stop. Read-only `corpus:review` (including `--verified-gap`) may be run. Codified in [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md).
  - *Incident (recorded factually):* on 2026-08-11 Claude executed the 12-row Batch 1 `corpus:approve` pass on the user's explicit instruction "Run the 12-row approval pass now." Under the rule above that was wrong — a human should have run those commands. The approvals **stand** (the sign-off attribution and primary-source URLs are correct and were the user's own decision); they are not reverted. The rule exists to prevent recurrence, not to unwind a correct-in-substance result.
- **Verification is a distinct, later human step from approval.** Approval promotes `draft → in_force` (a checkpoint may be relied upon). Verification (`corpus:verify`) stamps `citation_verified_date` + verifier once a human has opened the primary source and confirmed the pinpoint against it. It touches only the verification columns, never approved content (which the immutability trigger freezes). All 12 Batch 1 rows are `in_force` but **unverified** — `npm run corpus:review -- --verified-gap` is the work queue.
- **2026-09-06 — Passport disclosure model v2: the public tier shows PER-CHECKPOINT detail** (supersedes the counts-only passport). For every applicable checkpoint the public passport now shows its id, plain-language requirement, verdict, reason category, and the primary legal citation with a source link. *Rationale:* the rule set is public law — showing which rules are met removes doubt rather than creating it. **Public vs gated is a firm line.** Public (passport): pack title, aggregate material summary ("corrugated ×3"), verdict counts, per-checkpoint verdict + reason + citation, corpus version, PCF summary. Gated (report only, never on the passport): evidence document references, supplier/sourced-from identities, assessor risk-annotation rationale, component weights and full BOM composition, delta-action wording. Component-subject checkpoints are aggregated to one worst-verdict row so no component identity leaks. The change is versioned: regenerating a v1 passport appends a hash-chained version with changelog "Disclosure model v2".
- **2026-09-06 — Public passport bypasses the access gate by design; app chrome must not render on it.** `/passport/<token>` is ungated (the public disclosure layer). The bug where it tripped a Basic Auth challenge was the shared header rendering gated app-nav links on the public page; fixed by moving app routes into an `(app)` route group so the passport renders on the bare root layout with no gated links. The proxy bypasses only `_next/static`, `_next/image`, `favicon.ico`, `passport/` — never API routes or app routes.

## Open items / blockers

Batch 1 is **approved** (12 `in_force` under `batch-1`). Sprint 4 (extraction + magic-link
intake) merged to main (PR #5); the smoke fix merged (PR #7); the DoC generator is a
stacked branch (PR #6, **open**). The extraction harness (`eval/extraction/`) is in;
the material taxonomy split and the register-lookup fields are draft, awaiting approval.
**Branch/PR state as of 2026-09-08:** #5 merged, #6 (doc-drafting) open on main, #7
(smoke fix) merged; the current harness/taxonomy work is on `sprint-4-harness`.

| Item | Owner | Status |
|---|---|---|
| **Verify the 12 Batch 1 rows against primary** (`corpus:verify`) — all 12 are `in_force` but `citation_verified_date` NULL; `corpus:review --verified-gap` is the queue. Human-only; commands below. | Akshay | **Pending** |
| **Approve Batch 2 EU (9 rows) under `batch-2-eu`** — validated H, reconciled to primary. Now also carry the C1 register-public-lookup fields (DE set + verified; ES/FR/IT/NL/PL null → verify below). Human-only. | Akshay | **Ready — validated** |
| **Approve Batch 2 India (7 rows) under `batch-2-in`** — validated H, verbatim; approve after EU. Human-only. | Akshay | **Ready — validated** |
| **Approve ISPM-15 v2 (wood taxonomy)** — `INTL-ISPM15-heat-treatment@2` seeded DRAFT (material wood_solid, applies_when wood_solid, processed-wood exemption reason). v1 stays in_force meanwhile. Human-only. | Akshay | **Ready — draft** |
| **Verify the MS register public-lookup (C1)** for ES, FR, IT, NL, PL — `register_public_lookup`/`register_lookup_url` are NULL pending confirmation of each register's public search against its official page; DE (LUCID) is set + verified reachable. Confirm at Batch 2 EU approval. | Akshay | **TODO** |
| **Evidence guidance (6 rows)** — seeded `draft`; approve via `corpus:approve --guidance` (human-only) once reviewed. | Akshay | Pending |
| **Approve the PPWR Annex VIII encoding** (`EU-DoC-AnnexVIII@1`) — fetched verbatim from EUR-Lex, seeded `draft`; review with `corpus:review -- --doc-templates`. The DoC draft generator stays blocked until approved. Human-only. | Akshay | **Ready — review** |
| **Run the extraction harness live** — `eval/extraction/` is DRY-green (SHA-256 of all 25 synthetic docs validated, matcher exercised). The live SYNTHETIC-CEILING run needs a working `ANTHROPIC_API_KEY` (it was empty in `.env` / absent from the environment at build time): `ANTHROPIC_API_KEY=… npm run eval:extraction`. | Akshay | **Blocked — key** |
| **Pilot deployed** — production alias `https://pkg-compliance.vercel.app`; migrate-on-deploy live; post-deploy smoke green (`/api/health` bypassed for the probe). | — | **Done** |
| Merge PR #6 (doc-drafting) and the harness/taxonomy PR — note the migration-number collision: #6 defines 0034/0035 (doc-templates/document-drafts) and this branch defines 0034/0035 (wood-taxonomy/register-lookup); whichever merges second must renumber. | Akshay | Pending |
| Remaining [docs/SCHEMA_DELTAS.md](docs/SCHEMA_DELTAS.md) decisions (#4, #5, #9) | Akshay | Pending |
| 2 further real client packs for the golden dataset; Kyoto EF access + GreenAlign interface details; product name (`pkg-compliance`) | Akshay | Pending |

### Human-only actions pending — exact commands (never Claude)

```bash
# Approve Batch 2 EU (repeat per row id; source-url = primary law per row)
npm run corpus:approve -- --id <EU-row-id> --version <v> --source-url <eur-lex-url> --approved-by "Akshay Tandon" --corpus-version batch-2-eu
# Approve Batch 2 India (after EU)
npm run corpus:approve -- --id <IN-row-id> --version <v> --source-url <gazette-url> --approved-by "Akshay Tandon" --corpus-version batch-2-in
# Approve ISPM-15 v2 (wood taxonomy)
npm run corpus:approve -- --id INTL-ISPM15-heat-treatment --version 2 --source-url https://www.ippc.int/en/core-activities/standards-setting/ispms/ --approved-by "Akshay Tandon"
# Approve the PPWR Annex VIII encoding (doc-template)
npm run corpus:approve -- --doc-template --id EU-DoC-AnnexVIII --version 1 --approved-by "Akshay Tandon"
# Approve the 6 evidence-guidance rows
npm run corpus:approve -- --guidance --id <checkpoint-id> --version <v> --evidence-type <type> --approved-by "Akshay Tandon"
# Run the extraction harness live (with a funded key)
ANTHROPIC_API_KEY=… npm run eval:extraction
```

### Batch 1 verification pass — ready to paste (human-only)

Batch 1 is already `in_force`; this stamps `citation_verified_date` + verifier once each pinpoint is confirmed against primary. It touches only the verification columns, never approved content. Review the queue first with `npm run corpus:review -- --verified-gap`, open each source, then run the matching command. All are version 1.

```bash
npm run corpus:verify -- --id EU-PPWR-heavy-metals --version 1 --verified-by "Akshay Tandon"
npm run corpus:verify -- --id EU-PPWR-pfas-food-contact --version 1 --verified-by "Akshay Tandon"
npm run corpus:verify -- --id EU-PPWR-soc-minimisation --version 1 --verified-by "Akshay Tandon"
npm run corpus:verify -- --id EU-PPWR-no-chemical-preservative --version 1 --verified-by "Akshay Tandon"
npm run corpus:verify -- --id EU-PPWR-composite-plastic-relevant --version 1 --verified-by "Akshay Tandon"
npm run corpus:verify -- --id EU-PPWR-technical-documentation --version 1 --verified-by "Akshay Tandon"
npm run corpus:verify -- --id EU-PPWR-declaration-of-conformity --version 1 --verified-by "Akshay Tandon"
npm run corpus:verify -- --id EU-PPWR-operator-id-manufacturer --version 1 --verified-by "Akshay Tandon"
npm run corpus:verify -- --id EU-PPWR-operator-id-importer --version 1 --verified-by "Akshay Tandon"
npm run corpus:verify -- --id EU-PPWR-no-transitional-stock --version 1 --verified-by "Akshay Tandon"
npm run corpus:verify -- --id EU-EPR-producer-registration --version 1 --verified-by "Akshay Tandon"
npm run corpus:verify -- --id INTL-ISPM15-heat-treatment --version 1 --verified-by "Akshay Tandon"
```
