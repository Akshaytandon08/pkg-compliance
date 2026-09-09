# Schema deltas surfaced by the Exide golden fixtures

Raised for product-owner decision before Batch 1 seeds. Writing expected verdicts for the Exide seven against brief §5 surfaced eight gaps. **None are implemented** beyond the three approved corrections — seeding on top of an unresolved answer is what we are trying to avoid.

Source of the findings: [eval/fixtures/client-a-traction-cell.json](../eval/fixtures/client-a-traction-cell.json) (the anonymised golden run), validated by [eval/golden-fixtures.test.ts](../eval/golden-fixtures.test.ts).

---

## 1. A verdict needs two input axes, not one authored field

The manual run recorded lines 1–6 as **"QUALIFIED — conditional"** and line 7 as **"CONDITIONAL — test recommended"**. These are the *same verdict* (`conditional`) at different risk, distinguished by whether a routine declaration or a lab test is the closing evidence. Flattening them loses the distinction; keeping them as two verdict values makes the enum non-orthogonal.

**Implemented** in [src/lib/engine/verdict.ts](../src/lib/engine/verdict.ts) as a pure function of two axes:

| designAssessment | evidenceState | → verdict | risk |
|---|---|---|---|
| `non_compliant` | any | `gap` | high |
| `no_inherent_risk` / `at_risk` | `complete` | `qualified` | low |
| `no_inherent_risk` | absent / insufficient / expired | `conditional` | low |
| `at_risk` | absent / insufficient / expired | `conditional` | medium |

**Decision needed:** confirm the `designAssessment` vocabulary (`no_inherent_risk` / `at_risk` / `non_compliant`) and that `risk` is *derived*, never authored — otherwise two seeders will disagree on what "medium" means.

## 2. Checkpoints do not all attach to a component — RESOLVED

**Ruling:** `subject` enum column `component | packaging_unit | organisation`, NOT NULL (migration `0004`). Note the vocabulary is `packaging_unit`/`organisation`, not the originally-proposed `pack`/`consignment`. The consignment/destination-market second-order concern (below) stands: `organisation`-subject checkpoints still need a destination-market input the BOM lacks.


Brief §1 specifies a report "per component per checkpoint", but four of the checkpoints the Exide run adjudicated have no component subject:

- technical documentation, Declaration of Conformity, operator-identification marking → **pack** level
- EPR producer registration → **consignment / destination-market** level, and depends on Member States of first placing, *which the BOM does not carry*

**Proposal:** add `subject: component | pack | consignment` to the checkpoint schema. Without it, pack-level checkpoints get silently duplicated across every component line, or dropped.

**Second-order:** consignment-level checkpoints need a destination-market input the BOM object does not have. Either the upload flow captures destination Member States, or these checkpoints render as unresolvable caveats.

## 3. BOM completeness is a pre-evaluation stage, not a checkpoint verdict

The photo-gap findings (P1 steel corner plates, P2 plywood box system) are not checkpoint failures — no checkpoint was evaluated, because the component was never declared. They come from checklist #33 (BOM-to-physical reconciliation), which is where the real Exide gap was caught.

**Proposal:** a distinct `bom_completeness` finding type, evaluated *before* checkpoint evaluation, whose output is `gap` + `bom_addition` action. It must not aggregate into the overall verdict the same way a design failure does — the manual run's overall verdict stayed CONDITIONAL despite two gaps, precisely because they were declaration gaps rather than chemistry failures. This aggregation rule is pinned by a test.

## 4. Data-integrity findings are not compliance findings

Three Exide findings are BOM-internal contradictions evaluated against no law:

- line 5: `containsPlastic: true` contradicts a kraft + water-based-adhesive composition
- line 7: material class recorded `composite`; pigment does not make a composite
- line 6: mandatory plastic weight blank

**Proposal:** a separate `data_integrity_rules` set with its own finding type. These must never render as compliance verdicts — but they *block* qualification, so they need a place in the report between "verdict" and "action".

## 5. `not_applicable` carries an evidence obligation

Checklist #3 requires recording the *scoping reasoning* for PFAS non-applicability: "Do not skip the note — inspectors check the reasoning, not just the result." So N/A is not an absence of work.

Related: the manual run flagged as a data correction that recyclability on wood/metal/paper lines read "Not applicable" when it should read **"Assessment pending"**. An unassessed forward requirement rendered as inapplicable is a reporting defect.

**Proposal:** `not_applicable` requires a `scopingNote`; add a distinct `assessment_pending` disposition.

## 6. `evidence_type` and action type are two vocabularies — RESOLVED

**Ruling:** the DoC/`technical_file` conflation (the core of this delta) is resolved by adding a distinct evidence type `conformity_declaration` (Commit 10); `EU-PPWR-declaration-of-conformity` now requires it. Actions that are not evidence are already separated in the fixture format — BOM completeness carries `requiredAction: "bom_addition"` and data-integrity findings live in their own `dataCorrections[]` section — so evidence and action vocabularies are distinct. `photo_record` is not yet needed by any checkpoint; it folds into the still-open delta #3 (BOM-completeness stage) if that is adopted.

Brief §5 lists six `evidence_type` values. The Exide evidence tracker's "Type" column uses a different set: *Supplier declaration, Data correction, BOM addition, Technical file, DoC, Registration, Marking, Test report*. Mixing them conflates "what closes this checkpoint" with "what the user must do next".

**Proposal:** keep `evidence_type[]` on the checkpoint; add a separate `action_type` vocabulary for delta actions, including `bom_addition` and `data_correction` which are not evidence at all. Also missing from `evidence_type`: `photo_record` (required by checklist #33).

## 7. Reports must record an as-of date, not only a corpus version

Brief §5 requires reports to record the corpus version for reproducibility. That is necessary but insufficient: forward flags are date-relative (2030 recyclability grades, recycled content). The same corpus version evaluated on two dates yields different verdicts.

**Proposal:** reports record **corpus version + as-of date**, and the evaluator takes `asOf` as an explicit parameter. Already threaded through `evaluability(checkpoint, asOf)`.

## 8. Threshold must be a list — RESOLVED

**Ruling:** `threshold` object replaced by `thresholds` JSONB array, implicit AND across elements, each `{parameter, operator, value, unit, applies_when?}` (migration `0004`). PFAS now carries its three limits structurally.

Brief §5 defines `threshold` as one structured object. PFAS (§6 facts ledger) has three simultaneous limits: 25 ppb single substance, 250 ppb sum of non-polymeric, 50 ppm total organic fluorine. Heavy metals is a single summed parameter and fits, but PFAS does not.

**Proposal:** `threshold` becomes an array, all limits ANDed. One checkpoint per limit would fragment a single legal requirement across three rows and triple the approval burden.

## 9. Checkpoint ID convention (proposal, needs blessing)

Fixtures use `<GEOGRAPHY>-<INSTRUMENT>-<slug>` — `EU-PPWR-heavy-metals`, `EU-EPR-producer-registration`, `INTL-ISPM15-heat-treatment`.

Article numbers are deliberately **excluded** from IDs and live only in `citation`. Reasons: several article references are on the §6 re-verify list, so encoding them in IDs guarantees churn when verification corrects one; and duplicating the citation into the ID creates two sources of truth that can disagree. Cost: IDs are not self-citing, so a reader must join to `citation`.

## 10. Validation-report controls (Batch 2 EU) — RESOLVED, implemented

The Batch 2 EU validation report (§5) surfaced structured content that did not fit the existing columns without being flattened into `notes`/`requirement_text` (where it can't be rendered or queried). Added as **separate fields** (migration `0022`), all in the immutability trigger's frozen set; the approval gate is unchanged.

Checkpoint-level:
- **`later_of_condition`** (text) — the "…or N months after act X, whichever is later" phase-in clause; not a fixed `trigger_date`.
- **`exemptions`** (JSONB `Exemption[]` = `{scope, basis_pinpoint}`) — scoped carve-outs, each separately citable, so the report can flag "subject to exemptions".
- **`future_law_watch`** (text) — proposed/pending legislation to monitor; **never** treated as in force.
- **`source_corroborating`** (URL) — a secondary corroborating source; **must not** be the primary `citation`.
- **`confidence`** (enum `H|M|L`) — analyst confidence, **distinct from `status`** (a row can be in_force yet M, or draft yet H).

Organisation-level (Stack B registration):
- **`official_register`**, **`register_operator`**, **`producer_responsibility_organisation`** — THREE separate columns. A PRO (CITEO, CONAI…) is never a register; a DB CHECK (`checkpoints_register_not_pro`) plus a corpus test refuse a PRO value in `official_register`.
- **`registration_threshold`** vs **`contribution_threshold`** (text, optional) — kept separate (the NL lesson): the threshold to *register* and the threshold to *contribute/report* can differ.

## 11. The extraction claim-type vocabulary omitted ~half the expected fields — RESOLVED, implemented

**Ruling (2026-09-09): approved and implemented** (Part 3b). Not a migration:
`extracted_claims.claim_type` is a `text` column, so extending the vocabulary is a
change to the *prompt/tool schema surface* and the deterministic matcher, not to
the database.

**How it surfaced.** The Part 1 error analysis
([docs/extraction-error-analysis.md](extraction-error-analysis.md)) classified every
missed field across both models. Class (b) — "comparison too strict" — was **empty
(0 of 393 fields)**, so no comparison fix could help. Instead the most-missed
parameters shared one property: **no `claim_type` slot existed for them**, and the
Anthropic tool `input_schema` constrains `claim_type` to that enum — so the model
*could not emit them however it was instructed*. Counts of 10/10 (5 documents × 2
models) mean missed on every document by both models:

| Class | Structurally-missed parameters (miss count) |
|---|---|
| supplier_declaration | signatory_designation (20), signatory_name (19), batch_reference (18), compliance_standard (13), heavy_metals_sum_limit (12), document_reference (10), length/width/dynamic_load_capacity/construction (10 each) |
| lab_test_report | product_grade, accreditation_reference, screening_method, signatory_name, signatory_designation, document_reference, batch_reference, client, sample_received_date, test_start_date (10 each) |
| heat_treatment_certificate | quantity, document_valid_until, signatory_name, signatory_designation, ippc_country_code, ippc_provider_code (10 each), batch_reference, treatment_code (9), ippc_mark_code, document_reference (8) |
| mill_declaration | inks, adhesives, coatings, signatory_name, signatory_designation (10 each), virgin_fibre_share, substance_minimisation_standard, heavy_metals_sum_limit, batch_reference (8) |

**Added.** Shared document-identity types on all four classes — `signatory`
(parameter `name` \| `designation`), `document_reference`, `batch_or_lot_reference`,
`document_validity`. Per class: supplier gains `stated_limit`,
`compliance_standard`, `physical_dimension`; lab gains `product_grade`,
`client_identity`, `screening_method`, `sample_date`; heat-treatment gains
`ippc_mark_element` (parameter `country_code` \| `producer_code` \|
`treatment_code` \| `mark_code`) and `physical_dimension`; mill gains
`virgin_fibre_share`, `substance_group_statement` (inks/adhesives/coatings),
`compliance_standard`, `stated_limit`.

**Propagation (the part that makes it more than a prompt edit).**
- **Evidence matcher** ([src/lib/extraction/matching.ts](../src/lib/extraction/matching.ts)):
  `ippc_mark_element` satisfies `marking` evidence — an element read off the stamp
  *is* the ISPM-15 marking, exactly as the whole mark is. `substance_group_statement`
  and `virgin_fibre_share` carry `supplier_declaration`.
- **Deliberate non-evidence.** `METADATA_CLAIM_TYPES` names the types that identify
  or date a document but close no checkpoint (signatory, document_reference,
  batch_or_lot_reference, document_validity, physical_dimension, client_identity,
  sample_date, product_grade, compliance_standard, screening_method). They are
  absent from the evidence map **by decision**, so a reviewer can tell the omission
  is intentional rather than an oversight.
- **Flag wiring.** A `stated_limit` / `compliance_standard` claim now carries the
  cited standard, so a limit quoted against the wrong standard feeds
  `flag_wrong_standard` (previously only a `test_method` claim could trigger it).
- **Prompts** bumped to `1.2.0`, one changelog entry per class naming the missed
  parameters the addition targets.

**Unchanged:** the LLM still only *extracts*; every claim remains a
pending-confirmation proposal judged by the deterministic engine, and corpus
approval discipline is untouched.
