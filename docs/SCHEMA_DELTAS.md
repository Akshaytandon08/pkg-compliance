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

## 2. Checkpoints do not all attach to a component

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

## 6. `evidence_type` and action type are two vocabularies

Brief §5 lists six `evidence_type` values. The Exide evidence tracker's "Type" column uses a different set: *Supplier declaration, Data correction, BOM addition, Technical file, DoC, Registration, Marking, Test report*. Mixing them conflates "what closes this checkpoint" with "what the user must do next".

**Proposal:** keep `evidence_type[]` on the checkpoint; add a separate `action_type` vocabulary for delta actions, including `bom_addition` and `data_correction` which are not evidence at all. Also missing from `evidence_type`: `photo_record` (required by checklist #33).

## 7. Reports must record an as-of date, not only a corpus version

Brief §5 requires reports to record the corpus version for reproducibility. That is necessary but insufficient: forward flags are date-relative (2030 recyclability grades, recycled content). The same corpus version evaluated on two dates yields different verdicts.

**Proposal:** reports record **corpus version + as-of date**, and the evaluator takes `asOf` as an explicit parameter. Already threaded through `evaluability(checkpoint, asOf)`.

## 8. Threshold must be a list

Brief §5 defines `threshold` as one structured object. PFAS (§6 facts ledger) has three simultaneous limits: 25 ppb single substance, 250 ppb sum of non-polymeric, 50 ppm total organic fluorine. Heavy metals is a single summed parameter and fits, but PFAS does not.

**Proposal:** `threshold` becomes an array, all limits ANDed. One checkpoint per limit would fragment a single legal requirement across three rows and triple the approval burden.

## 9. Checkpoint ID convention (proposal, needs blessing)

Fixtures use `<GEOGRAPHY>-<INSTRUMENT>-<slug>` — `EU-PPWR-heavy-metals`, `EU-EPR-producer-registration`, `INTL-ISPM15-heat-treatment`.

Article numbers are deliberately **excluded** from IDs and live only in `citation`. Reasons: several article references are on the §6 re-verify list, so encoding them in IDs guarantees churn when verification corrects one; and duplicating the citation into the ID creates two sources of truth that can disagree. Cost: IDs are not self-citing, so a reader must join to `citation`.
