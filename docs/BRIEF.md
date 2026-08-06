# Packaging Compliance Intelligence — Prototype Build Brief

> Verbatim source of truth, ingested 2026-08-06. Product decisions here are settled — raise deltas to the product owner (Akshay Tandon), do not re-open in implementation.

Status: Approved for prototype build. Product decisions below are settled — do not re-open them in implementation; raise deltas to the product owner. Product owner & named regulatory owner: Akshay Tandon (interim; every corpus change requires his sign-off — treat this as a hard gate, not a review). Positioning: Standalone Fitsol product (name TBD — do not invent one; use the working codename `pkg-compliance` in code). Integrates with GreenAlign (supplier evidence flows) and Kyoto (emission factors). British spelling in all user-facing output.

## 1. What this is

A qualification engine for packaging compliance across geographies. A user (Indian packaging manufacturer or brand-owner exporter) uploads a Bill of Materials with sourced-from details plus available evidence (lab reports, certificates, declarations). The system returns: (a) a qualification report — Qualified / Conditional / Gap per component per checkpoint, with delta actions; (b) an auto-populated response to a customer compliance questionnaire; (c) a screening-grade cradle-to-gate PCF; (d) a QR-resolved, hash-signed passport page per packaging SKU.

What this is NOT (liability guardrails — enforce in code):

* It never issues, generates, or labels anything as a "Declaration of Conformity" or "certification". Output language is "qualification screening" and "evidence assembly".
* The LLM extracts; it never adjudicates. Pass/fail is deterministic rule evaluation only.
* Any checkpoint with `status: contested` or missing primary citation renders with a visible caveat.
* PCF output is labelled "screening-grade, ISO 14067-aligned methodology" — never "audit-grade" or "verified".

## 2. Personas and legal roles (two separate dimensions — never conflate)

* Persona (commercial identity, chosen at onboarding): (1) packaging manufacturer; (2a) tier-1 / white-label exporter; (2b) OEM selling own goods in-geography.
* Legal role (derived per transaction from facts, not from persona): manufacturer / importer / distributor / EPR producer. The same crate maker is unobligated under PPWR when their crate travels around a client's goods, and the full-obligation "manufacturer" when exporting empty pallets to the EU. Where role derivation is ambiguous (e.g. exporter designs own packaging for white-label goods), the engine flags for legal confirmation — it does not silently assign.

Primary prototype flow: Persona 2a — customer questionnaire lands, user uploads it + BOM + evidence, system populates and gap-flags.

## 3. The four-stack architecture (top level of the knowledge graph)

* Stack A — Market access: what packaging must BE (substances, design, food-contact, ISPM-15, conformity documentation).
* Stack B — EPR / money: registration, reporting, fees, recycled-content mandates, certificate obligations. Owns the obligation calendar (renewals, filing deadlines). This is the recurring-revenue engine.
* Stack C — Claims & labelling: what may be said/shown (recyclability marks, harmonised labels, green-claims substantiation). Owns the passport/QR layer.
* Stack D — Cradle-to-gate emissions: PCF per SKU from the same BOM object. Structural, not decorative: CBAM makes embedded emissions customs law for metal packaging traded as goods (CN 7310 steel containers, CN 7612 aluminium containers ≤300 L, CN 7318 fasteners; definitive regime live 1 Jan 2026; certificates retroactive early 2027, ≥50% coverage for 2027). Eco-modulated EPR fees (Oregon live, PPWR Art. 53 from 2030) price design via LCA. PCF method: mass × material EF + conversion + inbound transport, ISO 14067 cradle-to-gate, declared data hierarchy (primary supplier data → India-specific secondary EF → global proxy, provenance always shown). Seed the factor library from Fitsol's existing pallet EF research and ISO 14067 bamboo calculator methodology.

The coupling thesis (why the combo sells): the same BOM + evidence graph clears the border (A), decides the recurring fee (B), substantiates the claim (C), and answers the buyer's Scope 3 request (D). TCO² in regulatory form.

## 4. Prototype scope (ruthless — non-goals are binding)

* Geographies: EU + India only.
* Materials: corrugated, plastics, wood in full. Metal = one CBAM-flag rule only.
* Stacks: A complete; B calendar-only (no fee computation); C static signed passport page; D screening-grade PCF.
* Non-goals: US/Middle East rules; eco-modulation fee optimiser; multi-tenancy polish; auth beyond basic; marketplace/Greenfind integration; anything emitting DoC/certification language.

## 5. Checkpoint schema (the core data model)

Checkpoints are versioned DATA, not code. Fields:

```
id, version, geography, jurisdiction_level (EU/MS/national/state),
stack (A|B|C|D), material[] (corrugated|plastic|wood|metal|all),
legal_role[] (manufacturer|importer|distributor|epr_producer),
persona_relevance[], packaging_level[] (sales|inner|outer|transport|pallet|ecomm),
trigger_date, sunset_date, status (in_force|upcoming|contested|superseded),
requirement_text, threshold (structured: parameter, operator, value, unit),
evidence_type[] (supplier_declaration|lab_test|registration|marking|technical_file|test_report),
test_method, citation (primary legal source, article-level — MANDATORY),
citation_verified_date, notes, food_contact_only (bool)
```

Rules for the corpus:

* Every checkpoint cites primary law at article level (EUR-Lex, CPCB notification, gazette). Aggregator/consultancy sources are discovery aids only — a checkpoint without a primary citation cannot ship.
* Every corpus change is a versioned commit approved by the regulatory owner. Reports record the corpus version used, so any report is reproducible months later.
* `contested` status exists because live rules face litigation (e.g. California SB 54 challenges) — carry the flag into report rendering.

## 6. Facts ledger from the discovery phase

Verified (multi-source or primary, July–Aug 2026): PPWR (EU) 2025/40 applies 12 Aug 2026, no placed-on-market grace; heavy metals Pb+Cd+Hg+Cr(VI) ≤100 mg/kg per component; PFAS 25 ppb single / 250 ppb sum non-polymeric / 50 ppm total organic fluorine — food-contact packaging only; Module A self-assessment DoC per Annex VII/VIII, retention 5 yrs single-use / 10 yrs reusable; composite ≥5% plastic by weight treated as plastic-relevant; "manufacturer" = brand/spec owner per Commission guidance (30 Mar and 5 Jun 2026 publications); branch office cannot be importer — subsidiary or authorised representative. US: 7 enacted EPR states (ME, OR, CA, CO, MN, MD, WA); fees live OR (Jul 2025) + CO (Jan 2026); CA SB 54 regs effective 1 May 2026, registration 1 Jun, baseline 1 Jul, fees from Jan 2027; SB 343 chasing-arrows enforcement Oct 2026 (federal challenge pending); CAA is multi-state PRO. CBAM as in §3. UAE: MOCCAE/Tadweer EPR pilot completed; framework maturing, rollout anticipated 2026. Saudi: SASO Technical Regulation for Degradable Plastic Products current — oxo-biodegradable mandate for listed disposable PP/PE ≤250 µm, food/medical excluded, logo licence + annual renewal; direct conflict with EU oxo ban for in-scope products; market noise claims a ban — resolve against SASO primary text before any Gulf checkpoint ships.

Must re-verify from primary sources during Sprint 1 (do not trust conversation values): India recycled-content percentages and category-wise EPR targets (CPCB notifications); TPCH state count; EU harmonised-labelling act timing; Italy plastic tax status; CN 7317 (nails) CBAM status; PPWR 2030 numbers (70% recyclability floor, grade dates, Art. 29 40% transport reuse target) — cite EUR-Lex directly.

## 7. Sprint plan and acceptance criteria

* Sprint 1 — Corpus + schema. Implement schema; seed ~60–80 EU+India checkpoints (skeleton: the 34-checkpoint automotive checklist artefact + the Exide assessment artefact, both in `/reference`); re-cite every rule to primary law (clears §6 flags). Golden dataset: Exide traction-cell packaging BOM (7 components + 2 photo-gap components) with known verdicts, plus 2 more real packs.
* Sprint 2 — Engine. Extraction pipeline (Claude API): BOM/cert/lab-report → structured claims with expiry, lab accreditation (NABL/ILAC), test-method match, cert-covers-this-component check. Deterministic evaluator. Report generator (Exide-workbook format) + questionnaire auto-fill. Acceptance: ≥95% checkpoint agreement with the manual Exide assessment; report <10 min from upload.
* Sprint 3 — Stack D + passport + pilot. PCF module; QR → hash-signed tiered-disclosure page (public / buyer / audit layers, change-logged); run 3 real client packs end-to-end, ≥1 paying.

Tech: Next.js + PostgreSQL (match Fitsol Asset Classification Directory conventions). Checkpoints in DB with migration-versioned corpus. Claude API for extraction with structured-output prompts; prompts live in repo under `/prompts` with eval harness against the golden dataset — scaling must not silently change verdicts.

## 8. Reference artefacts (place in `/reference` in the repo)

* `PPWR_Assessment_Exide_Traction_Cell_Packaging.xlsx` — the manual golden-run: verdict logic, evidence tracker, report format to reproduce.
* `EU_Export_Packaging_Compliance_Checklist_Automotive.xlsx` — 34-checkpoint seed corpus with applicability, deadlines, evidence types.
* `PPWR_Packaging_Data_Request_Template__1_.xlsx` — a real inbound customer questionnaire; the Persona 2a auto-fill target format.
