# pkg-compliance — Development Plan

Working codename: `pkg-compliance` (product name TBD — do not invent one).
Source of truth for product decisions: [docs/BRIEF.md](docs/BRIEF.md). Decisions there are settled; raise deltas to Akshay Tandon (product owner & interim regulatory owner). Every corpus change requires his sign-off — hard gate.

**Status: Sprint 0 complete — scaffold up, build green. Next: Sprint 1 corpus seeding. Last updated: 2026-08-06.**

## Hard constraints (enforce in code, verify in review)

1. No output may say "Declaration of Conformity", "certification", "audit-grade", or "verified". Language: "qualification screening", "evidence assembly", "screening-grade, ISO 14067-aligned methodology".
2. LLM extracts only; pass/fail is deterministic rule evaluation.
3. `contested` status or missing primary citation → visible caveat in rendered reports.
4. A checkpoint without an article-level primary citation cannot ship.
5. Persona ≠ legal role. Role is derived per transaction; ambiguous derivation → flag for legal confirmation, never silently assign.
6. Reports record the corpus version used (reproducibility).
7. British spelling in all user-facing output.

## Scope (binding)

- Geographies: EU + India only.
- Materials: corrugated, plastics, wood in full; metal = single CBAM-flag rule.
- Stacks: A complete; B calendar-only; C static signed passport page; D screening-grade PCF.
- Non-goals: US/Middle East rules, fee optimiser, multi-tenancy polish, auth beyond basic, Greenfind integration, any DoC/certification language.

## Tech decisions

- Next.js + PostgreSQL (match Fitsol Asset Classification Directory conventions).
- Checkpoints are versioned data in DB; corpus changes via migration-versioned commits.
- Claude API for extraction, structured-output prompts in `/prompts`, eval harness against golden dataset — model/prompt changes must not silently change verdicts.
- Integrations: GreenAlign (supplier evidence), Kyoto (emission factors).

## Sprint 0 — Repo setup (current)

- [x] Ingest brief → `docs/BRIEF.md`
- [x] Development plan (this file)
- [x] Git repo initialised, initial commit
- [x] Three reference artefacts received into `/reference` (2026-08-06; sheet structure verified against brief §8)
- [x] Scaffold: Next.js 16 (App Router, TS, Tailwind) + Postgres 16 (Docker) + Drizzle ORM with SQL migrations. Checkpoint + corpus_versions schema implemented per brief §5 (migration `0000_corpus-schema`). Forbidden-language guardrail in `scripts/check-language.mjs`, wired into `npm run check`.
  - Convention delta to confirm against Fitsol Asset Classification Directory: ORM choice (Drizzle) — swap only if Fitsol standard differs.

## Sprint 1 — Corpus + schema

- [ ] Checkpoint schema per §5 of the brief (all fields; versioned data, not code)
- [ ] Corpus change workflow: versioned commit + regulatory-owner approval gate
- [ ] Seed ~60–80 EU+India checkpoints from the two reference artefacts
- [ ] Re-cite every rule to primary law (EUR-Lex / CPCB / gazette, article level)
- [ ] Clear the §6 re-verify list from primary sources (do NOT trust conversation values):
  - India recycled-content % and category-wise EPR targets (CPCB notifications)
  - TPCH state count
  - EU harmonised-labelling act timing
  - Italy plastic tax status
  - CN 7317 (nails) CBAM status
  - PPWR 2030 numbers: 70% recyclability floor, grade dates, Art. 29 40% transport reuse target (EUR-Lex direct)
- [ ] Golden dataset: Exide traction-cell BOM (7 components + 2 photo-gap) with known verdicts, + 2 more real packs

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
| Fitsol Asset Classification Directory conventions (repo access / doc) | Akshay | Pending |
| Kyoto EF access + GreenAlign evidence-flow interface details | Akshay | Pending |
| Product name | Akshay | TBD — use `pkg-compliance` |
