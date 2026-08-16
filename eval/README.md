# Eval harness

The eval harness is the contract between the corpus and the engine. Fixtures here encode real packaging screenings with **known-correct expected verdicts**; once the extraction + evaluation engine exists (Sprint 2), it must reproduce them. Scaling the model or changing a prompt must not silently move a verdict — this harness is what makes that failure loud.

- `fixtures/` — one JSON file per golden pack.
- `golden-fixtures.test.ts` — validates each fixture's *internal* consistency against the deterministic verdict rule table ([src/lib/engine/verdict.ts](../src/lib/engine/verdict.ts)) and this format contract. Runs now.
- `engine-verdicts.test.ts` — asserts the **engine's** verdicts against the fixtures. Skipped until the engine lands; the assertions are written so wiring is a one-line change.

Both are picked up by `npm test` / `npm run check`.

## Fixture format (version 4) — the contract

If encoding a real pack cannot be expressed in this format without distortion, that is a **schema/format gap to report, not a fixture to bend**. Gaps found so far live in [docs/SCHEMA_DELTAS.md](../docs/SCHEMA_DELTAS.md) and in the "Known format gaps" section below.

- **v2** resolved SCHEMA_DELTAS **#2** (checkpoint `subject`) and **#8** (thresholds as a list), and the eval-format AND/OR gap via CNF evidence requirements.
- **v3** adds `assessment_context` (the evaluation inputs the BOM does not carry — destination Member States, food-contact, persona, reusability, role-derivation facts) and the `applies_when` applicability mechanism keyed on it. This closes the organisation-subject second-order gap: a checkpoint that needs context the assessment lacks yields a `caveat` (`CONTEXT_REQUIRED`), never a silent pass or a gap.

### Top level

| Field | Meaning |
|---|---|
| `fixtureFormatVersion` | `2`. Bumped when this contract changes. |
| `pack` | `{ id, description, source, screeningDate }`. Client identity is **anonymised** (`Client A`, …); no personal contact data. |
| `asOf` | Screening date the expected verdicts are evaluated as-of. Forward-dated requirements are flags, not verdicts, relative to this. |
| `assessment_context` | The authoritative evaluation inputs (see below). `applies_when` conditions read these. |
| `scope` | `{ geography, packagingLevel[], scopingNotes[] }` — descriptive only; evaluation inputs live in `assessment_context`. |
| `legalRole` | Derived role + whether it was ambiguous. Ambiguous → `expectedFlag: "legal_confirmation_required"`, never a silent assignment. |
| `components[]` | One per BOM line: `claims`, `evidenceDocuments[]`, and `expected[]` (one per checkpoint). |
| `packLevelExpected[]` | Checkpoints whose `subject` is `packaging_unit` or `organisation`, not `component`. |
| `bomCompletenessGaps[]` | Components in the physical pack but absent from the BOM. Pre-evaluation findings, not checkpoint verdicts. |
| `dataCorrections[]` | BOM-internal contradictions (no law evaluated). |
| `notApplicable[]` | Out-of-scope checkpoints, each with a recorded scoping note. |
| `forwardFlags[]` | Requirements applying from a future date. |
| `expectedOverall` | `{ verdict, summary, hardBlockers[], counts }`. |

### Assessment context

The inputs an evaluation needs that the BOM alone does not carry. Every fixture carries one.

```jsonc
{
  "destination_member_states": ["DE"],   // Member States of first placing; drives EPR applicability
  "food_contact": false,                 // drives food-contact checkpoints (e.g. PFAS applies_when)
  "persona": "2a",                        // commercial identity chosen at onboarding
  "declared_reusable": false,             // reusable vs single-use packaging
  "legal_role_facts": {                   // facts for role derivation — never a role
    "packaging_branded": false,           // does the packaging carry a brand/trademark?
    "custom_vs_standardised": "custom",   // "custom" | "standardised"
    "spec_defined_by": "customer"         // who defined the spec: "user" | "customer" | "supplier"
  }
}
```

Where a value is not truly known it is marked assumed in `scope.scopingNotes` (the golden fixture assumes `DE`).

**FAQ role-derivation rules** (Commission PPWR FAQ, interpretive — see [docs/regulatory-sources.md](../docs/regulatory-sources.md)). The `manufacturer` legal role follows from `legal_role_facts`:

- **branded** → the trademark owner is the manufacturer;
- **unbranded + standardised** → the physical producer is the manufacturer;
- **unbranded + custom** → the party that defined the specification (`spec_defined_by`) is the manufacturer.

When these facts point outside the user's own organisation (e.g. an unbranded custom pack whose spec was defined by the user's *customer*), the manufacturer role is ambiguous — set `legalRole.ambiguous: true` with `expectedFlag: "legal_confirmation_required"`. The engine flags; it never silently assigns (brief §2). The golden fixture is exactly this case.

### Applicability (`applies_when`)

A corpus checkpoint may carry an `applies_when` object keyed on `assessment_context` fields; `null` means it always applies. Values are either a literal to match (`{ "food_contact": true }`) or the sentinel `"present"`, meaning the context field must be a non-empty array (`{ "destination_member_states": "present" }`).

**BOM material facts.** An `applies_when` key may also reference a fact derived from the BOM rather than from `assessment_context`. The key `bom_material_present` resolves against the set of materials present in the pack — e.g. `INTL-ISPM15-heat-treatment` carries `{ "bom_material_present": "wood" }` (it applies only when solid wood is in the BOM). The engine resolves each key against `assessment_context` first, then BOM-derived facts; an unresolvable key yields `CONTEXT_REQUIRED` as usual.

Evaluation:

- condition satisfied → the checkpoint is evaluated normally;
- condition not satisfied → `not_applicable` (with a recorded scoping note);
- condition **cannot be evaluated** because the context field is missing/empty → verdict `caveat`, reason `CONTEXT_REQUIRED`. **Never a silent pass, never a gap.** The report asks the user for the missing context.

### Expected verdict entry

Each entry in `components[].expected[]` and `packLevelExpected[]`:

The harness (`engine-verdicts.test.ts`) feeds these entries to `evaluateCheckpoint` — the SAME core the production path uses — and measures agreement. `evidenceRequirements` and `appliesWhen` are the checkpoint-definition snapshot embedded per entry (corpus-independent). `designAssessment` is an **extraction input**, not something the deterministic evaluator derives; the golden pack pins it and the harness feeds it. What the engine derives — and what the agreement rate measures — is evidence state (CNF + scope + expiry), applicability, reason code and risk.

```jsonc
{
  "checkpointId": "EU-PPWR-heavy-metals",  // matches a corpus checkpoint id
  "checkpointVersion": 1,                   // the corpus version this verdict is pinned to
  "subject": "component",                   // component | packaging_unit | organisation (packLevelExpected only)
  "appliesWhen": null,                       // optional; the checkpoint's applies_when snapshot
  "verdict": "qualified | conditional | gap | not_applicable",
  "designAssessment": "no_inherent_risk | at_risk | non_compliant",
  "evidenceState": "complete | insufficient | absent | expired",
  "risk": "low | medium | high",
  "reasonCode": "EVIDENCE_ABSENT",          // from the vocabulary below
  "evidenceRequirements": { "allOf": [{ "anyOf": ["supplier_declaration"] }] }, // CNF, see below
  "scopeMismatch": {                        // optional: present when a document is on file but out of scope
    "documentId": "…", "coversComponent": false, "reason": "…"
  },
  "basis": "free-text explanation"
}
```

`verdict` and `risk` are **derived** from (`designAssessment` × `evidenceState`) by the rule table — never authored independently. The test asserts they agree.

### Evidence requirements (CNF)

`evidenceRequirements` is conjunctive normal form: an outer `allOf` (AND) of inner `anyOf` (OR) clauses, **exactly one nesting level**, every leaf an evidence type. The PET strap closes on a pigment specification **or** an XRF/lab test — `{ "allOf": [{ "anyOf": ["pigment_spec", "lab_test"] }] }`. Two independent things both required would be two `allOf` clauses.

A **genuine `allOf`** (two independent things both required) — reusable packaging must have *both* a design specification *and* reuse-system documentation: `{ "allOf": [{ "anyOf": ["technical_file"] }, { "anyOf": ["technical_file", "supplier_declaration"] }] }`. Two clauses, both must be satisfied. Recognise this shape when a checkpoint needs more than one distinct evidence item, versus the single-clause `anyOf` used when any one document closes it.

**The CNF rule: if a requirement cannot be expressed in one level of CNF, split the checkpoint.** No nesting beyond allOf→anyOf; no anyOf-of-allOf. This keeps evaluation and delta-action generation mechanical.

### Reason-code vocabulary

| Code | Verdict | Meaning |
|---|---|---|
| `EVIDENCE_COMPLETE` | qualified | Evidence on file closes the checkpoint. |
| `EVIDENCE_ABSENT` | conditional | No evidence on file; a routine declaration would close it. |
| `EVIDENCE_INCOMPLETE` | conditional | Partial evidence; more needed. |
| `EVIDENCE_EXPIRED` | conditional | Evidence present but past expiry. |
| `TEST_REQUIRED` | conditional | Genuine chemistry/design risk; a lab test is the closing evidence (medium risk). |
| `DESIGN_NONCOMPLIANT` | gap | Inherent design/chemistry failure; paperwork cannot close it. |
| `NOT_IN_BOM` | gap | Component in the physical pack but absent from the BOM. |
| `NOT_APPLICABLE_SCOPE` | not_applicable | Out of scope; scoping note recorded. |
| `FORWARD_NOT_YET_IN_FORCE` | (flag) | Applies from a future date; reported as a forward flag, not a verdict. |
| `CONTEXT_REQUIRED` | (caveat) | `applies_when` cannot be evaluated — required `assessment_context` is missing. Never a pass or a gap. |

### Evidence document schema

`components[].evidenceDocuments[]` — empty when nothing is on file (which is itself ground truth: absent evidence ⇒ conditional).

```jsonc
{
  "docId": "…",
  "type": "supplier_declaration | lab_test | registration | marking | technical_file | test_report | pigment_spec | conformity_declaration",
  "issuer": "…",              // organisation only; no personal contact data
  "issuedDate": "YYYY-MM-DD | null",
  "expiryDate": "YYYY-MM-DD | null",
  "scope": {                  // what the document actually covers — drives cert-covers-this-component
    "components": ["…"],
    "materials": ["…"],
    "parameters": ["Pb", "Cd", "Hg", "Cr(VI)"]
  },
  "labAccreditation": "NABL | ILAC | null"
}
```

`conformity_declaration` names the obligated operator's own EU declaration of conformity — the user's document, never a system output. It is a distinct evidence type so a DoC is not conflated with a generic `technical_file` (SCHEMA_DELTAS #6).

**On-component markings must be modelled as `evidenceDocuments` to score.** The engine derives evidence state only from `evidenceDocuments`, so a mark stamped on the component (e.g. the ISPM-15 HT/IPPC mark) counts only when entered as a `marking` document scoped to that component — narrating it in `claims` alone leaves the checkpoint `absent`. This pattern applies to any "the mark is the evidence" checkpoint (ISPM-15, operator identification). The golden pack's pine pallet carries its HT stamp as a `marking` document, which is what makes ISPM-15 score `qualified` (agreement 17/17).

## Known format gaps

1. ~~`blockingEvidence` has no AND/OR semantics.~~ **Resolved** — replaced by CNF `evidenceRequirements` (`allOf` of `anyOf`), with the split rule above.
2. ~~Cert-scope mismatch is unexercised.~~ **Resolved** — `eval/fixtures/client-b-strap-cert-scope.json` exercises a document on file whose scope does not cover the component (expected `conditional`, `EVIDENCE_INCOMPLETE`, with a `scopeMismatch` detail).
3. ~~Pack/organisation-level checkpoints have no component subject.~~ **Resolved** — SCHEMA_DELTAS #2: `subject` enum (`component | packaging_unit | organisation`) is now a NOT NULL column.
