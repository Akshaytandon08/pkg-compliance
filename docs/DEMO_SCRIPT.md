# Demo script — the 5-minute path

The three-pack demo runs entirely on seeded **demonstration data** (every pack
carries a "Demonstration data" tag; every fabricated evidence reference is
prefixed `SYNTHETIC-DEMO`). Nothing here is a real client screening.

## Before you start

```bash
docker compose up -d          # Postgres (host port 5433)
npm run db:migrate            # ensure schema is current
npm run seed:factors          # emission factors for the footprint (SEED-ESTIMATE)
npm run seed:demo-suite       # (re)seed exactly three demo packs — idempotent
npm run dev                   # http://localhost:3000
```

Packs are referenced by **name**, not id — the seed recreates them each run, so
ids shift. All three are stamped to corpus version `batch-1` and render real
verdicts.

## The path

**1 — The list (`/`).** Three packs, each with a purple **Demo** chip:
- *Client A — traction-cell (demo)* — the anonymised golden run, blocked by
  missing evidence.
- *Demo — corrugated export carton* — a clean, well-evidenced pack.
- *Demo — food-contact laminate pouch* — food contact triggers PFAS.

**2 — A qualified pack (green), and a DRAFT declaration of conformity.** Open
**Demo — corrugated export carton**. Non-food, no wood; every component carries a
supplier declaration AND the pack carries its pack-level evidence (technical file,
operator marking, EPR registration), so it resolves **14 qualified · 1 conditional ·
3 N/A**. The single conditional row is the **Declaration of Conformity itself** —
expected, since that is the document the next step drafts; technical documentation,
operator identification and producer registration now qualify because the pack-level
obligations evaluate against the pack's documents, not an empty set. PFAS shows
**N/A** (non-food). Scroll to the **Draft EU declaration of conformity** card: because
this pack is eligible (the user is the manufacturer — branded, own-spec — and every
other requirement is qualified) the **Generate draft** button is enabled. Generate it
and open the **PDF preview** — a Fitsol-branded, watermarked DRAFT with the verbatim
Annex VIII structure, a materials table, article-by-article conformity, and blank
"to complete by the manufacturer" fields; download the **.docx** the manufacturer
signs. Stress: it **drafts, it never issues** — not a declaration until signed.
Then the **Cradle-to-gate footprint (screening-grade)** card — a per-component
mass × emission-factor estimate with a pack total, each figure showing its factor
source and data-quality tier; a screening estimate on placeholder factors, not
audit-level and not independently assured, no LLM touches the number.

**3 — The gap → guidance → template → evidence loop.** Open **Client A —
traction-cell (demo)**. It is mostly conditional — the pack is blocked by missing
evidence, not by chemistry. Each component is now a **table** — one row per
applicable rule, columns *Rule · Verdict · Why · Evidence relied on · Citation ·
Action* — so you scan the Verdict column rather than reading every card. Sort by
**Verdict** to bring gaps to the top. Walk one row end to end:
- The **Green polyester strap (PET)** carries an assessor **at-risk** annotation
  (green pigment families historically included lead chromate) → **Conditional**
  with **"Test required"** in the *Why* column, and the annotation shown as an
  **Assessor flag** in the expanded row. (A component with no annotation shows
  nothing there — there is no default "risk low".)
- **Expand the row** (click the rule name) for the full requirement text,
  thresholds, exemptions, phase-in and analyst confidence, plus the approved
  **"How to obtain this evidence"** guidance.
- Click any **evidence chip** — in the row or in "Evidence on file" — to open the
  evidence **drawer**: the stored document previewed inline, with the values read
  from it (issuer, page, confirmation status), or the typed record for a manual
  entry. Escape closes it and focus returns to the chip.
- Use **"Request evidence"** in the Action column to download the lab-test request
  as a **.docx**
  (with a **PDF preview** alongside) — a Fitsol-branded drafting aid the user sends
  to their lab, never a system-issued document. (Every document export is .docx +
  PDF; markdown is internal only.)
- **"Add evidence"** sits in the same Action cell: add a lab test (or test report)
  for the strap and save. The report re-evaluates in place and the strap flips
  **Conditional → Qualified**, with no code change and no corpus change.
- On a phone (≤768px) the same rows render as stacked cards in the same field
  order — nothing is hidden, the reading order just becomes vertical.
- A rule that does not apply yet shows as **Upcoming — applies from <date>**,
  muted, with no action: it is counted separately and never as a gap.

**4 — The applicability contrast.** Open **Demo — food-contact laminate pouch**.
Because `food_contact` is true, the **PFAS restriction now applies** (it was N/A
on the carton) and needs a lab test the pack does not have. The **barrier
coating** is annotated at-risk on fluorochemistry grounds → a `TEST_REQUIRED`
conditional. Same engine, different context — applicability is data-driven, not a
special case.

**5 — The public passport.** Back on any report (the carton reads best), open the
**Public passport** card and click **Generate passport**. A QR appears with an
unguessable public link. Open it (or scan the QR): the `/passport/<token>` page is
the **public tier** — pack name, aggregate material summary, verdict counts and
the footprint total, with a "Demonstration data" tag. The summary now also carries an
**Upcoming** count — requirements that exist but do not apply as of the screening date
(e.g. green claims from 2026-09-27; recyclability grade and recycled content from
2030-01-01). They are informational, never gaps, and never block the DoC draft. On a
Batch-1-only database this count is 0; on production it is not. (The carton's counts show the
pack-level obligations — technical documentation, operator identification, producer
registration — as **qualified**: these now evaluate against the pack's documents
rather than an empty set, so evidenced unit/organisation obligations resolve.) The
verdict count cards are anchors: click **Qualified** to jump to the checkpoints that
passed. The
**Checkpoints** section is the point to land on — every applicable rule with its
id, plain-language requirement, verdict, reason category and a link to the primary
law. The rule set is public law, so showing which rules are met removes doubt.
What is **not** here (report only, behind the gate): evidence documents, supplier
and sourced-from identities, the risk-annotation rationale, component weights and
the full BOM, and the delta-action wording. Note two things: the passport URL
works **without the login** (public disclosure layer; everything else stays gated),
and regenerating after a data change appends a **new hash-chained version** — the
prior hash is recorded, so tampering is evident.

Close on: every verdict is deterministic (no LLM decides pass/fail), every
checkpoint cites primary law, the footprint is a labelled screening estimate, and
the report is a screening — never a Declaration of Conformity.

## Reset

One idempotent command restores exactly the three packs (deletes any edits made
during the demo — e.g. the evidence you added to the strap — and recreates them):

```bash
npm run seed:demo-suite
```
