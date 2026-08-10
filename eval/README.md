# Eval harness

The eval harness is the contract between the corpus and the engine. Fixtures here encode real packaging screenings with **known-correct expected verdicts**; once the extraction + evaluation engine exists (Sprint 2), it must reproduce them. Scaling the model or changing a prompt must not silently move a verdict — this harness is what makes that failure loud.

- `fixtures/` — one JSON file per golden pack.
- `golden-fixtures.test.ts` — validates each fixture's *internal* consistency against the deterministic verdict rule table ([src/lib/engine/verdict.ts](../src/lib/engine/verdict.ts)) and this format contract. Runs now.
- `engine-verdicts.test.ts` — asserts the **engine's** verdicts against the fixtures. Skipped until the engine lands; the assertions are written so wiring is a one-line change.

Both are picked up by `npm test` / `npm run check`.

## Fixture format (version 2) — the contract

If encoding a real pack cannot be expressed in this format without distortion, that is a **schema/format gap to report, not a fixture to bend**. Gaps found so far live in [docs/SCHEMA_DELTAS.md](../docs/SCHEMA_DELTAS.md) and in the "Known format gaps" section below.

Version 2 (from the schema-deltas rulings) resolves SCHEMA_DELTAS **#2** (checkpoint `subject`) and **#8** (thresholds as a list), and the eval-format AND/OR gap via CNF evidence requirements.

### Top level

| Field | Meaning |
|---|---|
| `fixtureFormatVersion` | `2`. Bumped when this contract changes. |
| `pack` | `{ id, description, source, screeningDate }`. Client identity is **anonymised** (`Client A`, …); no personal contact data. |
| `asOf` | Screening date the expected verdicts are evaluated as-of. Forward-dated requirements are flags, not verdicts, relative to this. |
| `scope` | `{ geography, foodContact, packagingLevel[], reusable, scopingNotes[] }`. |
| `legalRole` | Derived role + whether it was ambiguous. Ambiguous → `expectedFlag: "legal_confirmation_required"`, never a silent assignment. |
| `components[]` | One per BOM line: `claims`, `evidenceDocuments[]`, and `expected[]` (one per checkpoint). |
| `packLevelExpected[]` | Checkpoints whose `subject` is `packaging_unit` or `organisation`, not `component`. |
| `bomCompletenessGaps[]` | Components in the physical pack but absent from the BOM. Pre-evaluation findings, not checkpoint verdicts. |
| `dataCorrections[]` | BOM-internal contradictions (no law evaluated). |
| `notApplicable[]` | Out-of-scope checkpoints, each with a recorded scoping note. |
| `forwardFlags[]` | Requirements applying from a future date. |
| `expectedOverall` | `{ verdict, summary, hardBlockers[], counts }`. |

### Expected verdict entry

Each entry in `components[].expected[]` and `packLevelExpected[]`:

```jsonc
{
  "checkpointId": "EU-PPWR-heavy-metals",  // matches a corpus checkpoint id
  "checkpointVersion": 1,                   // the corpus version this verdict is pinned to
  "subject": "component",                   // component | packaging_unit | organisation (packLevelExpected only)
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

### Evidence document schema

`components[].evidenceDocuments[]` — empty when nothing is on file (which is itself ground truth: absent evidence ⇒ conditional).

```jsonc
{
  "docId": "…",
  "type": "supplier_declaration | lab_test | registration | marking | technical_file | test_report | pigment_spec",
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

## Known format gaps

1. ~~`blockingEvidence` has no AND/OR semantics.~~ **Resolved** — replaced by CNF `evidenceRequirements` (`allOf` of `anyOf`), with the split rule above.
2. ~~Cert-scope mismatch is unexercised.~~ **Resolved** — `eval/fixtures/client-b-strap-cert-scope.json` exercises a document on file whose scope does not cover the component (expected `conditional`, `EVIDENCE_INCOMPLETE`, with a `scopeMismatch` detail).
3. ~~Pack/organisation-level checkpoints have no component subject.~~ **Resolved** — SCHEMA_DELTAS #2: `subject` enum (`component | packaging_unit | organisation`) is now a NOT NULL column.
