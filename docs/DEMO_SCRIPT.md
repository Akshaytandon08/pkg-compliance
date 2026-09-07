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

**2 — A qualified pack (green).** Open **Demo — corrugated export carton**.
Non-food, no wood, and every component carries a supplier declaration, so the
component checkpoints resolve **qualified** (≈9 qualified vs ≈6 conditional). The
conditional rows are the *pack-level* obligations that evidence cannot close from
a BOM alone — the Declaration of Conformity, technical documentation, operator
identification and producer registration. Point out that PFAS shows as **N/A**
here: it is a non-food pack. Scroll to the **Cradle-to-gate footprint
(screening-grade)** card — a per-component mass × emission-factor estimate with a
pack total, each figure showing its factor source and data-quality tier. Stress
the label: a screening estimate on placeholder factors, not audit-level and not
independently assured; no LLM touches the number.

**3 — The gap → guidance → template → evidence loop.** Open **Client A —
traction-cell (demo)**. It is mostly conditional — the pack is blocked by missing
evidence, not by chemistry. Walk one card end to end:
- The **Green polyester strap (PET)** carries an assessor **at-risk** annotation
  (green pigment families historically included lead chromate) → a
  `TEST_REQUIRED` conditional with the rationale shown.
- Expand **"How to obtain this evidence"** — the approved guidance for the
  evidence type (what a compliant document must contain, what to watch for).
- Use **"Request templates"** to download the lab-test request — a drafting aid
  the user sends to their lab, never a system-issued document.
- In **"Add evidence"**, add a `lab_test` (or `test_report`) for the strap and
  save. The report re-evaluates in place and the strap flips **conditional →
  qualified**, with no code change and no corpus change.

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
the footprint total, with a "Demonstration data" tag. The verdict count cards are
anchors: click **Qualified** to jump to the checkpoints that passed. The
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
