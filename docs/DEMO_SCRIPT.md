# Demo script — the 20-minute customer flow

The three-pack demo runs entirely on seeded **demonstration data**: every pack
carries a "Demonstration data" tag, every fabricated evidence reference is
prefixed `SYNTHETIC-DEMO`, and each seeded organisation carries `SYNTHETIC-DEMO`
in its **legal name** — because that name reaches a draft declaration of
conformity and the public passport, and those must never be mistaken for the real
thing even as a screenshot. Nothing here is a real client screening.

Timings below are the 20-minute customer flow. **For the 5-minute cut**, run
segments 1, 3 and 7 only (list → gap-to-evidence loop → passport) and skip the
draft DoC.

## Before you start

```bash
docker compose up -d          # Postgres (host port 5433)
npm run db:migrate            # ensure schema is current
npm run seed:demo-suite       # (re)seed three packs + three organisations — idempotent
npm run dev                   # http://localhost:3000
```

Packs are referenced by **name**, not id — the seed recreates them each run, so
ids shift. All three are stamped to corpus version `batch-1` and render real
verdicts.

---

## 1 — The list (1 min)

`/` shows three packs, each with a purple **Demo** chip:

- *Client A — traction-cell (demo)* — the anonymised golden run, blocked by
  missing evidence.
- *Demo — corrugated export carton* — a clean, well-evidenced pack.
- *Demo — food-contact laminate pouch* — food contact triggers PFAS.

## 2 — Who the screening is for (2 min)

Open **Demo — corrugated export carton**. The report header leads with
**Prepared for: Rheinsolt Verpackungswerke GmbH (SYNTHETIC-DEMO) · Germany · EPR
producer** — the obligated economic operator — and Fitsol appears below as a
**Prepared by** byline.

Say why that ordering matters: a compliance document is addressed to a legal
person. The operator carries the obligation; the tool prepared the screening and
certifies nothing. An assessment with no organisation on file says **"No
organisation recorded"** — it does not guess.

Point at **New assessment → Organisation** to show where that comes from: select
an existing operator or create one (legal name, country, usual role, address,
contact, and a producer registration per Member State). The "usual legal role" is
a starting point only — the role that drives the screening is derived from the
legal-role facts on the assessment, so a stored default can never override a
determined role.

## 3 — A qualified pack, and the numbers behind it (3 min)

Still on the carton. Non-food, no wood; every component carries a supplier
declaration AND the pack carries its pack-level evidence (technical file, operator
marking, EPR registration), so it resolves **14 qualified · 1 conditional · 0 gap ·
3 N/A**. The single conditional row is the **Declaration of Conformity itself** —
expected, since that is the document the next segment drafts. PFAS shows **N/A**
(non-food).

Then the **Cradle-to-gate footprint (screening-grade)** card: per-component mass ×
emission factor with a pack total. Every row states its provenance — publisher and
dataset, region, year and tier. A material the owner has not selected a factor for
reads **"No factor selected"**, is excluded from the total, and the card says the
total is therefore partial.

> **Before the demo:** the seeded order-of-magnitude factors were removed in
> Sprint 9. Until the owner runs `npm run factors:select` for the demo materials,
> this card shows "No factor selected" on every row and a zero total. Shortlist
> with `npm run factors:candidates -- --all`, then select. That is the honest
> state, and it is a better thing to show than a number nobody chose — but decide
> which you want before you are in front of the customer.

Say it plainly: this is a screening estimate, it is not audit-level and not
independently assured, and **no LLM touches the number**.

## 4 — The draft declaration of conformity (4 min)

Scroll to the **Draft EU declaration of conformity** card. This pack is eligible
(the user is the manufacturer — branded, own-spec — and every other requirement is
qualified), so **Generate draft** is enabled. Generate it and open the **PDF
preview**: a Fitsol-branded, watermarked DRAFT with the verbatim Annex VIII
structure, a materials table and article-by-article conformity.

Land on **element 2**, the declarant block. It is **pre-filled** from the
organisation record — legal name, trading name, registered address, country and the
LUCID producer registration — and it is still a highlighted field reading
**"Pre-filled from the organisation record — CONFIRM BEFORE SIGNING"**. That
wording is the point: what the tool holds is what someone typed into an intake
form, and element 2 is the declarant identity on a legal instrument. The signer
confirms it; the tool does not assert it. Fields with nothing behind them still
read "To complete by the manufacturer" and stay blank.

Download the **.docx** the manufacturer signs. Stress: it **drafts, it never
issues** — not a declaration until signed. (Every document export is .docx + PDF;
markdown is internal only.)

## 5 — The gap → guidance → template → evidence loop (5 min)

Open **Client A — traction-cell (demo)** — prepared for *Meridian Cell
Technologies Private Limited (SYNTHETIC-DEMO) · India · Manufacturer*, a non-EU
operator with no EU producer registration on file. It is mostly conditional: the
pack is blocked by missing evidence, not by chemistry.

Each component is a **table** — one row per applicable rule, columns *Rule ·
Verdict · Why · Evidence relied on · Citation · Action* — so you scan the Verdict
column rather than reading every card. Sort by **Verdict** to bring gaps to the
top. Walk one row end to end:

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
  as a **.docx** (with a **PDF preview** alongside) — a Fitsol-branded drafting aid
  the user sends to their lab, never a system-issued document.
- **"Add evidence"** sits in the same Action cell: add a lab test (or test report)
  for the strap and save. The report re-evaluates in place and the strap flips
  **Conditional → Qualified**, with no code change and no corpus change.
- On a phone (≤768px) the same rows render as stacked cards in the same field
  order — nothing is hidden, the reading order just becomes vertical.
- A rule that does not apply yet shows as **Upcoming — applies from <date>**,
  muted, with no action: it is counted separately and never as a gap.

## 6 — The applicability contrast (2 min)

Open **Demo — food-contact laminate pouch** — prepared for *Kestrel Foods Europe
B.V. (SYNTHETIC-DEMO) · Netherlands · EPR producer*, a Dutch brand owner placing
on the German market, so it holds **two** producer registrations: German LUCID and
Dutch Verpact (Mijn Verpact). That is why registration is a table and not a column.

Because `food_contact` is true, the **PFAS restriction now applies** (it was N/A on
the carton) and needs a lab test the pack does not have. The **barrier coating** is
annotated at-risk on fluorochemistry grounds → a `TEST_REQUIRED` conditional. Same
engine, different context — applicability is data-driven, not a special case.

## 7 — The public passport (3 min)

Back on the carton report, open the **Public passport** card and click **Generate
passport**. A QR appears with an unguessable public link. Open it (or scan the QR):
`/passport/<token>` is the **public tier**.

It now leads with **"Declared by Rheinsolt Verpackungswerke GmbH (SYNTHETIC-DEMO) ·
Germany · EPR producer"**, and carries a **Producer registrations** block: the
registration number per Member State with the register's name. A producer register
is a public register — that is the point of it — so disclosing the number removes
doubt about whether the operator is registered where it places packaging. The
operator's address and contact do **not** appear: the public tier discloses the rule
set and who carries it, not correspondence details. The page also states that this
screening does not check the number against the register.

The summary carries pack name, aggregate material summary, verdict counts, the
footprint total and a "Demonstration data" tag, plus an **Upcoming** count —
requirements that exist but do not apply as of the screening date (green claims
from 2026-09-27; recyclability grade and recycled content from 2030-01-01). They
are informational, never gaps, and never block the DoC draft. On a Batch-1-only
database this count is 0; on production it is not.

The verdict count cards are anchors: click **Qualified** to jump to the checkpoints
that passed. The **Checkpoints** section is the point to land on — every applicable
rule with its id, plain-language requirement, verdict, reason category and a link to
the primary law.

What is **not** here (report only, behind the gate): evidence documents, supplier
and sourced-from identities, the risk-annotation rationale, component weights and
the full BOM, and the delta-action wording.

Note two things: the passport URL works **without the login** (public disclosure
layer; everything else stays gated), and regenerating after a data change appends a
**new hash-chained version** — the prior hash is recorded, so tampering is evident.
A passport minted before the declarant existed still verifies against its stored
hash: the field is optional and omitted, so it never perturbs the chain.

---

Close on: the screening is prepared **for a named operator**, every verdict is
deterministic (no LLM decides pass/fail), every checkpoint cites primary law, the
footprint is a labelled screening estimate, and the report is a screening — never a
Declaration of Conformity.

## Reset

One idempotent command restores exactly the three packs and their three
organisations (deleting any edits made during the demo — e.g. the evidence you
added to the strap):

```bash
npm run seed:demo-suite
```
