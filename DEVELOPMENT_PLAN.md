# pkg-compliance — Development Plan

Working codename: `pkg-compliance` (product name TBD — do not invent one).
Source of truth for product decisions: [docs/BRIEF.md](docs/BRIEF.md). Decisions there are settled; raise deltas to Akshay Tandon (product owner & interim regulatory owner). Every corpus change requires his sign-off — hard gate.

**Status: PILOT DEPLOYED and the corpus is approved + verified in production.** Production corpus: **29 `in_force`** — `batch-1` (12), `batch-2-eu` (10, including ISPM-15 v2 / wood taxonomy), `batch-2-in` (7) — **all verified** (`citation_verified_date` set). The 6 evidence-guidance rows are **approved + verified**, and the PPWR Annex VIII encoding (`EU-DoC-AnnexVIII@1`) is **approved on production**. Only the **FR Triman** row remains `draft` (unvalidated — deliberately left). **Engine/extraction as of 2026-09-11:** temporal `upcoming` state live; verbatim grounding + two-pass + 2-of-3 majority tiebreak on by default; synthetic ceiling **sonnet 51.7% mean (3 runs, 13.0-pt spread), unioned silent errors 0**; **provisional default model = sonnet, opus comparison outstanding** (measured at the real-document acceptance run). Sprints 1–4 delivered (report loop, guidance, templates, three-pack demo suite, Stack D PCF, Stack C passport, DoC draft generator, document extraction v1 + magic-link intake). Hosted at `https://pkg-compliance.vercel.app` with migrate-on-deploy, post-deploy smoke, **Vercel Blob object storage** and an **isolated preview database**. Engine 100% golden agreement (17/17). Extraction synthetic ceiling — **not** the acceptance metric — is **sonnet 9.9% / opus 38.4%** at prompt 1.0.0 under the corrected comparison; see the matcher-fix note below. **Last updated: 2026-09-09.**

> **Corrected extraction ceilings.** Figures previously quoted as *30.5% (sonnet) / 68.7% (opus)* were produced by a field-accuracy matcher with an unsafe token-subset rule (it matched whenever every ≥3-character token of the expected value appeared anywhere in any claim field, so "Grade A" matched "Grade B"). That rule is removed and the safe comparison is pinned by `eval/extraction/canonical.test.ts`. **The corrected figures replace the old ones everywhere.** All extraction numbers in this plan are a SYNTHETIC CEILING on 25 generated documents; acceptance is measured only on the product owner's real, PII-scrubbed set.

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

- [~] **PCF module (demo slice — Commit 32; factor provenance — Sprint 9).** Per-component mass × material emission factor + optional inbound transport leg; ISO 14067-aligned cradle-to-gate; deterministic, no LLM. **Sprint 9 removed the seeded `SEED-ESTIMATE` rows and the tier itself** (migrations `0039`/`0040`): a factor now carries source, dataset, `activity_id`, region, year, methodology, retrieval date, licence note and who selected it, on tier `primary | secondary_database | none`. Selection is **human-only** (`npm run factors:select`, AGENTS.md) off a Climatiq shortlist (`npm run factors:candidates`, read-only); Fitsol primary factors outrank secondary ones; assessments **pin** their factor set at first evaluation so a report never silently re-costs. A material with no selected factor renders "No factor selected" and is excluded, with the total labelled partial. Remaining: **the owner's selections** (no factor is selected yet, so every footprint is currently 0 / partial), the Fitsol primary data file (`reference/fitsol_primary_factors.csv`, ships empty), the full data hierarchy (primary supplier → India secondary → global proxy), and unit conversions beyond mass.
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

- **2026-09-11 — Two safeguard mechanisms, opposite outcomes, both kept.** *Retry-on-empty (Commit 6)* is implemented and **does not work**: a text-layer document returning <3 claims is retried once, and across docs 16/17/18 × 3 runs the retry fired twice and recovered neither (1→1, 0→0; dropout incidence 3/9 before and after). Retrying an *identical* request reproduces the *identical* near-empty answer — the failure is stable per (document, prompt) within a run though it varies between runs. Recovery therefore needs a **varied** retry (a user-turn nudge, or reordering pages), which changes the prompt and so belongs to a prompt-version bump: **deferred past Tuesday**, with the mechanism left in place so the variation has somewhere to land. *Majority tiebreak (Commit 7)* is **on by default** and does work, in a specific sense: on a two-pass disagreement a third pass runs and 2-of-3 carries, which cut withholding from 23/21 to 10/13 on comparable runs with **silent errors 0** — most disagreements are one bad read against two good ones, not genuine ambiguity. But the accuracy gain (61.8% mean against a 59.0% baseline, clean runs only) sits **inside a 15-point run-to-run spread**, so it is recorded as *reduces withholding; accuracy gain not established within variance*. Cost: extra calls 10 → 18 per run.
- **2026-09-11 — Why the harness runs N>1, stated concretely.** After run 1 alone the tiebreak read as **69.3%, +10.3 points over baseline**. Reporting there would have been an overclaim: run 3 came in at **54.2%**, below two of the three baseline runs, and the honest mean is 61.8% against 59.0% — inside the noise. One run is an anecdote. This is the rationale for every figure in this repo being a mean with its spread, and for silent errors being a **union** across runs rather than a single run's count.
- **2026-09-11 — A failed run is not a result.** Tiebreak run 2 scored 17.0% with 30% usable and one "silent error". Seven of its ten documents returned status `failed` — transient API errors, not model behaviour — which is also why it cost $0.20 against ~$0.75 for a real run; run 3 returned to 100% usable. Its silent error is a detector artefact: scope-transfer fires when a document's expected flags include `flag_scope_mismatch` and the extraction produced no claims at all, so there was no value to be wrong about. It is excluded from the conclusion and shown struck through in the tables, rather than quietly dropped.
- **2026-09-11 — Provisional default model is `sonnet`; the opus comparison is OUTSTANDING.** Opus was not run at prompt 1.3.0. (1) *Frugality* — a full-set opus run costs ~$2.75 against $2.32 of remaining budget, so the ledger would have cut it off mid-run: money spent, no comparison. (2) *API instability* — the failures that wrecked tiebreak run 2 would have made a single opus run unreadable, and there is no budget for a repeat. (3) *No demo dependency* — nothing in the Tuesday demo turns on model choice. The only opus data at 1.3.0 is a 10-document gate (68.7%, 0 silent errors, 100% usable, $0.098/doc), which is one class of one run and not a basis for a recommendation. **Opus variance is measured at the real-document acceptance run**, where the comparison actually decides something.
- **2026-09-11 — Flag ground truth: six rows accepted, one rejected, and the rejection is the interesting one.** The owner accepted `flag_low_confidence` on 05, 10, 12, 15, 20 and 25, and **rejected 16**. Doc 16 is a clean Tier-A document: an ungrounded snippet there is a **model defect**, not a gap in the ground truth, so raising the flag must keep scoring as a FALSE POSITIVE. Doc 12 was justified by the same mechanism (ungrounded) and *was* accepted — the distinction is the cleanliness of the source, not the mechanism that fired. The accepted rows are applied to the manifests; the side-by-side overlay is deleted, so the harness again reports one flag score against ground truth. Document files are untouched, so every SHA-256 still validates.

- **2026-09-09 — Production storage is Vercel Blob; the local-FS adapter is refused on any deployed environment.** The production "Generation failed" on the DoC draft button was the storage layer selecting the local-filesystem adapter (the default) and Vercel's serverless filesystem being **read-only** — `storeDraft`'s `mkdir`/`writeFile` threw `EROFS`. Fonts were *not* implicated (the .docx names DM Sans, the PDF used pdfkit's built-in Helvetica; both render in memory before the write). Fixed by implementing `BlobStorageAdapter` (private access; the app reads bytes back server-side with the store token and re-streams them through its own gated routes, so no blob URL reaches a client), auto-selected when `BLOB_READ_WRITE_TOKEN` is present. `resolveStorageBackend` **refuses** local-FS when `VERCEL_ENV` is `production` or `preview` — preview is the same read-only filesystem, so allowing it there would let the failure survive the very review meant to catch it. Enforcement is per-call in `getStorageAdapter`, not at boot, so a misconfiguration fails storage operations rather than taking down health/reports. The post-deploy smoke now probes `/api/health?storage=1`, which does a put→read→delete round-trip, so this class of failure is caught on deploy instead of on a user's first click.
- **2026-09-09 — Two orphan rows in the production migration ledger, from pre-isolation preview builds (owner-observed).** Reported by the product owner from a direct read of production: **38 rows in `drizzle.__drizzle_migrations` against 36 entries in `main`'s journal** — two extra records written by preview deployments that ran `vercel-build` against the **production** database, because `PREVIEW_DATABASE_URL` did not yet exist and the app fell back to `DATABASE_URL`. The stray `doc_templates` / `document_drafts` objects those builds created were **dropped by the owner on 2026-09-08**, before the renumbered `0036/0037` deploy, and carried only the unapproved Annex VIII seed — no approved row was lost. Recorded here as owner-observed: Claude could not verify it directly (pulling the production database credential was refused, correctly). Root cause is closed by `PREVIEW_DATABASE_URL` (set 2026-09-08, Preview scope) plus the AGENTS.md rule that parallel branches must not both add migrations. The same divergence exists on the local dev DB in a milder form — its ledger holds a *pre-rebase* hash for `0036_doc-templates`, so `db:migrate` there re-applies and collides; see the migrate-runner note below.
- **2026-09-09 — The empty corpus version `corpus-2026-09-08` came from a failed approval, and `corpus:approve` now validates the target first.** A `corpus:approve` run created the corpus-version row **before** calling `promoteCheckpointToInForce`; when the promotion then failed, the version row was already committed, leaving a corpus version with nothing under it. `scripts/corpus-approve.ts` now checks that the target checkpoint exists **and is `draft`** before any version row is written, and refuses with "no corpus version created" otherwise. The empty `corpus-2026-09-08` label is inert (no checkpoints reference it) and is left in place rather than deleted — production data is not hard-deleted to tidy a record.
- **2026-09-09 — Neon database password rotation is DEFERRED: accepted risk, owner decision.** The production Neon connection string was pulled into local tooling during the preview-deploy triage (`vercel link` wrote a `.env.local`, and the shared `DATABASE_URL` is scoped to Development/Preview/Production together). The owner has decided **not** to rotate the password at this time and to **accept the risk**, dated 2026-09-09. Mitigations in place: `.env.local` is gitignored; the credential was never printed to the transcript or committed; previews no longer use the production database. Revisit if the credential is ever shared further or if the pilot takes real client data.
- **2026-09-09 — `pib.gov.in` accepted as a primary source for two India rows.** The Press Information Bureau is the Government of India's official announcement channel, and for two India PWM rows it carries the authoritative statement where no gazette PDF was reachable. The owner accepts it as **primary** for those two rows; the corpus-approve primary-source gate is satisfied accordingly. This is a scoped exception, not a general widening: the India baseline remains the PWM Rules 2016 consolidated through G.S.R. 237(E) (31 Mar 2026), and a gazette citation supersedes a PIB one whenever it becomes available.
- **2026-09-09 — `temperature` cannot be pinned on Sonnet 5 / Opus 5, so extraction reproducibility is MEASURED, not suppressed.** The plan was to pin `temperature: 0` for the extraction adapter. These models **reject the parameter**: `400 invalid_request_error — "\`temperature\` is deprecated for this model."` It failed every call in the first 3× run (0.0% field accuracy across both models, 150 failed extractions) before being diagnosed. The parameter is removed. Because sampling cannot be fixed from the client, the acceptance rule for silent errors is the **UNION across N=3 runs per model**, and the harness reports per-run field accuracy plus its spread — a single clean run is not evidence when the count is nondeterministic. Lesson recorded in process terms: smoke-test one live call before launching a multi-run.
- **2026-09-09 — The reported extraction ceilings were inflated by an unsafe comparison; the corrected figures are 9.9% / 38.4%.** The harness field-accuracy matcher counted a match whenever every ≥3-character token of the expected value appeared **anywhere in any claim field** — so "Grade A" matched "Grade B", and an expected standard's digits matched inside an unrelated method string. Removed. The safe comparison is exact normalised/numeric equality, plus canonicalisation for equality-preserving surface forms only (mg/kg≡ppm, % forms, ISO/written dates, case/whitespace, issuer aliases), pinned in both directions by `eval/extraction/canonical.test.ts`. Under it, prompt-1.0.0 accuracy is **sonnet 9.9% / opus 38.4%**, replacing the previously reported 30.5% / 68.7% everywhere. Notably class (b) — "comparison too strict" — was **empty (0 of 393 fields)**, which is what redirected the work to the claim-vocabulary extension (SCHEMA_DELTAS #11) rather than further comparison tuning.
- **2026-09-09 — `vercel-build` uses a diagnostic migration runner.** `drizzle-kit migrate` swallowed the SQL error in the failing preview build: the Vercel log showed two benign NOTICEs and then `exited 1`, with no failing statement. `scripts/migrate.ts` applies migrations through drizzle's postgres-js migrator (same `__drizzle_migrations` bookkeeping, so it stays interchangeable with `drizzle-kit`) and on failure prints the Postgres error (code, detail, hint, position) **and the SQL of the first unapplied migration**. Tested before shipping: from-zero on a scratch database (38/38 applied, 16 tables) and incremental on an already-migrated database (clean no-op). Run against the dev DB it immediately identified that database's divergent `0036_doc-templates` ledger hash and printed the colliding `CREATE TABLE` — the capability it exists for.

- **2026-09-08 — Pre-existing engine gap fixed: pack-level obligations were evaluated against an empty document set.** `evaluatePack` passed `documents: []` for every `packaging_unit`/`organisation`-subject checkpoint, so technical documentation (Art 15), operator identification and EPR producer registration could **never** reach `qualified` for any pack — they showed perpetually `conditional`/`EVIDENCE_ABSENT` even when the manufacturer held the documents. They now evaluate against the pack's **aggregate** documents (`components.flatMap(c => c.documents)`); `deriveEvidenceState` already treats a non-component subject as unscoped, so any matching document type on any component covers it. Surfaced by the DoC eligibility work (the criterion "all applicable in_force checkpoints qualified" was otherwise unsatisfiable). The golden harness tests the evaluator core (`evaluateCheckpoint`/`decideVerdict`), not `evaluatePack` aggregation, so it is unaffected (17/17 preserved). Demo verdict counts changed accordingly — DEMO_SCRIPT re-captured. New demo counts: corrugated **14 Q / 1 C / 3 N/A** (the 1 conditional is the DoC checkpoint itself, the artefact drafted); food-contact **3 Q / 11 C**; traction-cell **3 Q / 26 C / 7 N/A**.
- **2026-09-08 — DoC eligibility follows the manufacturer, not EU establishment.** A non-EU party is the manufacturer under Reg (EU) 2025/40 Art 3(1)(13) and draws up the DoC (Art 15); establishment affects only importer verification (Art 18) and any AR requirement (Arts 44–45), which the draft notes. Eligibility derives the manufacturer from `legal_role_facts` per the Commission FAQ (branded → trademark owner; unbranded+standardised → physical producer; unbranded+custom → spec-definer) and is met when that single party is the assessing user, or the user declares they act for them. Disabled reasons name the actual ambiguity.
- **2026-08-11 — Corpus governance is HUMAN-ONLY, and it is enforced in Claude's operating rules.** `corpus:approve`, `corpus:reject` and `corpus:verify` mutate the regulatory record and are the regulatory owner's sign-off; they must be run by a human from their own terminal. Claude Code never runs them — regardless of instruction wording, including "the regulatory owner directs it" or an explicit "run it now". The correct response to such a request is to print the exact command(s) for the human and stop. Read-only `corpus:review` (including `--verified-gap`) may be run. Codified in [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md).
  - *Incident (recorded factually):* on 2026-08-11 Claude executed the 12-row Batch 1 `corpus:approve` pass on the user's explicit instruction "Run the 12-row approval pass now." Under the rule above that was wrong — a human should have run those commands. The approvals **stand** (the sign-off attribution and primary-source URLs are correct and were the user's own decision); they are not reverted. The rule exists to prevent recurrence, not to unwind a correct-in-substance result.
- **Verification is a distinct, later human step from approval.** Approval promotes `draft → in_force` (a checkpoint may be relied upon). Verification (`corpus:verify`) stamps `citation_verified_date` + verifier once a human has opened the primary source and confirmed the pinpoint against it. It touches only the verification columns, never approved content (which the immutability trigger freezes). All 12 Batch 1 rows are `in_force` but **unverified** — `npm run corpus:review -- --verified-gap` is the work queue.
- **2026-09-06 — Passport disclosure model v2: the public tier shows PER-CHECKPOINT detail** (supersedes the counts-only passport). For every applicable checkpoint the public passport now shows its id, plain-language requirement, verdict, reason category, and the primary legal citation with a source link. *Rationale:* the rule set is public law — showing which rules are met removes doubt rather than creating it. **Public vs gated is a firm line.** Public (passport): pack title, aggregate material summary ("corrugated ×3"), verdict counts, per-checkpoint verdict + reason + citation, corpus version, PCF summary. Gated (report only, never on the passport): evidence document references, supplier/sourced-from identities, assessor risk-annotation rationale, component weights and full BOM composition, delta-action wording. Component-subject checkpoints are aggregated to one worst-verdict row so no component identity leaks. The change is versioned: regenerating a v1 passport appends a hash-chained version with changelog "Disclosure model v2".
- **2026-09-06 — Public passport bypasses the access gate by design; app chrome must not render on it.** `/passport/<token>` is ungated (the public disclosure layer). The bug where it tripped a Basic Auth challenge was the shared header rendering gated app-nav links on the public page; fixed by moving app routes into an `(app)` route group so the passport renders on the bare root layout with no gated links. The proxy bypasses only `_next/static`, `_next/image`, `favicon.ico`, `passport/` — never API routes or app routes.

## Open items / blockers

The corpus is **approved and verified in production** (29 `in_force`; see the banner).
**Branch/PR state as of 2026-09-09:** PRs #5, #6 (doc-drafting), #7 (smoke), #8
(harness + taxonomy + register lookup) and #9 (extraction tool-schema fix) are all
**merged** to `main`. Current work is on `sprint-5-prod-storage-and-analysis`:
production Blob storage, the extraction error analysis, and the claim-vocabulary
extension (SCHEMA_DELTAS #11). The migration-number collision between the
doc-drafting and harness branches was resolved by renumbering doc-drafting to
`0036/0037`; the rule is now written down in [AGENTS.md](AGENTS.md).

| Item | Owner | Status |
|---|---|---|
| **Verify the corpus against primary** (`corpus:verify`) — all 29 production `in_force` rows are verified, and the 6 guidance rows too. | Akshay | **Done** |
| **Approve Batch 2 EU under `batch-2-eu`** — 10 rows `in_force` + verified (includes ISPM-15 v2). | Akshay | **Done** |
| **Approve Batch 2 India under `batch-2-in`** — 7 rows `in_force` + verified. Two rows cite `pib.gov.in`, accepted as primary by owner decision (Decision log, 2026-09-09). | Akshay | **Done** |
| **Approve ISPM-15 v2 (wood taxonomy)** — `INTL-ISPM15-heat-treatment@2` approved under `batch-2-eu`. | Akshay | **Done** |
| **FR Triman row** — remains `draft` and **unvalidated**; deliberately left, not to be approved until validated. | Akshay | **Deferred** |
| **Evidence guidance (6 rows)** — approved + verified in production. | Akshay | **Done** |
| **Approve the PPWR Annex VIII encoding** (`EU-DoC-AnnexVIII@1`) — **approved on production**, so the DoC draft generator is unblocked there. | Akshay | **Done** |
| **Run the extraction harness live** — done repeatedly, both models, N=3 runs. Corrected ceilings sonnet 9.9% / opus 38.4% at prompt 1.0.0; see [docs/extraction-error-analysis.md](docs/extraction-error-analysis.md). | — | **Done** |
| **Pilot deployed** — alias `https://pkg-compliance.vercel.app`; migrate-on-deploy; smoke probes `/api/health?storage=1` (storage round-trip); Vercel Blob store and isolated preview DB configured. | — | **Done** |
| **Repair the local dev DB migration ledger** — its `drizzle.__drizzle_migrations` holds a *pre-rebase* hash for `0036_doc-templates`, so `npm run db:migrate` re-applies it and collides with the existing table (production is unaffected; the strays there were dropped 2026-09-08). Command below. | Akshay | **TODO** |
| Remaining [docs/SCHEMA_DELTAS.md](docs/SCHEMA_DELTAS.md) decisions (#4, #5, #9) — #11 (claim vocabulary) is **resolved + implemented** | Akshay | Pending |
| 2 further real client packs for the golden dataset; Kyoto EF access + GreenAlign interface details; product name (`pkg-compliance`) | Akshay | Pending |

### Human-only actions pending — exact commands (never Claude)

The Batch 1 / Batch 2 / ISPM-15 v2 / guidance / Annex VIII approvals and their
verification are **complete in production** (29 `in_force` + 6 guidance, all
verified). What remains:

```bash
# FR Triman — deliberately NOT approved: the row is draft and unvalidated.
# Validate it against primary first; only then approve. Left here as a reminder,
# not as a command to run today.

# Repair the local DEV database migration ledger (NOT production — production's
# strays were dropped 2026-09-08). Its ledger holds a pre-rebase hash for
# 0036_doc-templates, so `npm run db:migrate` re-applies it and collides with the
# table that already exists. Re-point that one row at the current file hash:
docker exec packagingtraceability-db-1 psql -U pkg_compliance -d pkg_compliance -c \
  "UPDATE drizzle.__drizzle_migrations SET hash = '<sha256-of-drizzle/0036_doc-templates.sql>' \
   WHERE hash = (SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at OFFSET 36 LIMIT 1);"
# Get the expected hash with:
node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('drizzle/0036_doc-templates.sql','utf8')).digest('hex'))"
# Then confirm the runner is a clean no-op:
node --experimental-strip-types --env-file=.env scripts/migrate.ts   # expect: [migrate] all migrations applied.
```

Read-only review tooling Claude may run: `npm run corpus:review` (including
`--verified-gap` and `--doc-templates`).

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
