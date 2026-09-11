# Placeholder audit — user-facing strings

Sprint 8, Commit 3. Every user-facing string in the app was scanned for
`placeholder`, `TODO`, `TBC`, `to be confirmed`, `coming soon`, `not implemented`,
`lorem`, `dummy`, `sample text`. Scope: `src/app/**` and `src/lib/**` (rendered
pages, exported documents, and the vocabularies they draw on), plus
`reference/emission_factors_seed.csv`, whose `source` column is printed verbatim
on the report.

The distinction applied throughout:

- **Keep as honest** — the string describes a genuine limit of the *data* or the
  *law*. A reader needs it. Removing it would make the output look more certain
  than it is.
- **Fix** — the string describes a limit of *our own unfinished work*. It tells a
  customer nothing about their packaging and everything about our backlog.

`tests/report-labels.test.ts` now pins the outcome: no rendered report or passport
string, neither standing disclaimer, and no `source` value in the factor CSV may
match that pattern again.

## Findings

| # | String (as it reached the reader) | Where | Verdict | Action taken |
|---|---|---|---|---|
| 1 | `SEED-ESTIMATE (placeholder — replace with Fitsol/primary EF)` | Footprint card, *Source · tier* column — every row of every report | **Fix** | The column now renders via `factorSourceLabel()`. A `SEED-ESTIMATE` factor reads **"Screening factor — indicative"** and names no source, because it has none. A sourced factor still prints `<source> · <tier>` — that is what makes the number checkable. |
| 2 | `SEED-ESTIMATE (placeholder — replace with Fitsol/primary EF)` | `reference/emission_factors_seed.csv`, `source` column (the stored value behind #1) | **Fix** | The `source` column now holds a source — `No primary source — order-of-magnitude estimate`. The instruction to replace these with sourced factors moved to `notes`, which is internal and not rendered. A to-do is not a provenance record. |
| 3 | "Figures use **placeholder** emission factors; each shows its source and data-quality tier." | `PCF_DISCLAIMER` — under every footprint total, report and passport | **Fix** (wording only — the caveat stays) | Now: "Emission factors are **indicative** unless a sourced factor is shown; each row states which it is." Same caveat, stated as a property of the data rather than as a note about our roadmap — and it is now *accurate*, since a sourced factor would no longer be described as a placeholder. |
| 4 | "Next due date **to be confirmed**" | Obligation calendar, per recurring obligation | **Fix** (wording only) | Now: "**No fixed due date in the rule**". The old wording implied someone at Fitsol still had to confirm it. The truth is the opposite: the instrument sets a cadence and no anchor date, so there is nothing to confirm. |
| 5 | "To complete by the manufacturer: `<label>`" on a field that had been **pre-filled** | Draft DoC, element 2, after Commit 2 | **Fix** (introduced and fixed in the same sprint) | A filled field now reads "**Pre-filled from the organisation record — CONFIRM BEFORE SIGNING**". A pre-filled field that still says "to complete" is the one a signer skims past. |
| 6 | `SEED-ESTIMATE` as a data-quality **tier** value | Footprint card, *Source · tier* column | **Keep as honest** | The tier vocabulary (`SEED-ESTIMATE` / `secondary` / `primary`) is a real provenance classification and is stored, queried and compared on it. It no longer *renders* for seeded rows (#1 replaces the whole cell), so the reader never sees the token — but the value stays in the schema. |
| 7 | "Demonstration data" tag; `SYNTHETIC-DEMO` prefixes on seeded evidence, addresses, registration numbers and organisation legal names | Report header, passport, DoC draft | **Keep as honest** | This is the whole point of the labelling: synthetic data must be unmistakable, including on a screenshot or an exported PDF separated from its tag. |
| 8 | `—` where a value is absent (mass, factor, test method, materials, claim value, parameter) | Footprint card, corpus browser, evidence drawer, passport | **Keep as honest** | An em dash is a *no value* marker, not a placeholder for a value we intend to supply. The alternative — inventing or omitting the row — is worse. |
| 9 | "No organisation recorded" | Report header, when `organisation_id` is null | **Keep as honest** | Introduced deliberately in Commit 2. The screening genuinely has no addressee on file and must say so rather than guess. |
| 10 | Form `placeholder=` attributes: `DE`, `e.g. LUCID (Zentrale Stelle Verpackungsregister)`, `e.g. Pb, Cd, Hg`, `comma-separated`, `Additional Member States (comma-separated, e.g. FI, DK)`, `expiry YYYY-MM-DD`, `value` | New-assessment form, organisation picker, claim review | **Keep as honest** | These are input hints showing the expected *format*, not unfinished content. They never appear in a saved record or an exported document. |
| 11 | "confirmed against the official register page (a review TODO)" | Code comment, `src/db/schema.ts:206` | **Keep as honest** | A code comment is not a customer surface. It records an open verification task for the regulatory owner and should stay until that verification happens. |
| 12 | "placeholder" in explanatory code comments (`labels.ts`, `pdf.ts` parameter name) | Source comments and one parameter identifier | **Keep as honest** | Not rendered. The `pdf.ts` `placeholder` parameter names the *blank vs filled* branch of a field, which is exactly what it does. |

## Residual

None outstanding. Items 1–5 are fixed in this commit (5 in Commit 2); items 6–12
are recorded as deliberate and covered by the tripwire test, which skips code
comments by design so item 11 can remain.
