# Emission-factor selection — runbook for the owner

**These commands are HUMAN-ONLY** (AGENTS.md). Claude Code does not run them.
Run them yourself, in your own terminal, **twice** — once locally and once with
`DATABASE_URL` pointed at production — then re-seed both.

Prepared 2026-09-13 from the `^36` public shortlists. Every row below is **BEIS
material-use, primary material production, cradle-to-gate, GB**, under **Open
Government Licence v3.0**, which permits republishing the value with Crown
copyright attribution — so all carry `--permit-value-display`.

`--data-version` is not passed: it defaults to `CLIMATIQ_DATA_VERSION=^36` from
`.env`, and is stored on every row. The tool reads the value back from Climatiq
and converts `kg/tonne → kgCO2e/kg` itself; do not retype numbers.

---

## ⚠️ Read this before running: five selections, not seven

`emission_factors` is keyed `(material, process)` and the BOM vocabulary has five
materials. Your seven variants collapse onto **four** BOM keys — plus `metal`,
added below — and a second
selection for the same key **supersedes** the first for every component of that
material — it does not sit alongside it.

| Your variant | BOM material | Outcome |
|---|---|---|
| corrugated board | `corrugated` | **selected** |
| kraft label | `corrugated` | ⚠️ same key — would overwrite the board factor for the 900 g carton too |
| LDPE film | `plastic` | ⚠️ same key — see below |
| PET strap | `plastic` | **selected** (heavier than the LDPE bag in both packs that contain them) |
| pine solid wood | `wood_solid` | **selected** |
| plywood | `wood_processed` | **selected** |
| MUF presswood | `wood_processed` | ⚠️ same key — `--none` here would wipe the plywood proxy |
| *(not in your seven)* nails | `metal` | **selected** — distinct key, no collision; see §1 command 5 |

Resolution taken below: **board** for `corrugated` (the kraft label is 15 g of a
1,265 g carton), **PET** for `plastic`. Swap either by running the superseded
command in §2 *afterwards* — last write wins.

No demo component uses `wood_processed`, so the plywood selection affects real
packs only.

---

## 0. Point each window at the right database — BOTH windows

An **exported `DATABASE_URL` overrides `.env`**, so a shell that has one left over
from an earlier session is pointed somewhere you did not choose. This happened on
2026-09-13: the "local" window still held a production Neon URL from a September
triage, and the first selection went to production. It failed only because the
credential had gone stale. Had it worked, five factors would have been written to
**production** from the local window — and the production window would then have
appended five more as version 2, leaving prod double-versioned and local empty.

Both writers now **print the target and refuse a remote one** unless `--remote` is
passed, so this cannot happen silently again. Start each window anyway:

```bash
# WINDOW 1 — local
unset DATABASE_URL
node --env-file=.env -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.hostname, u.pathname)'
# expect: localhost /pkg_compliance
```

```bash
# WINDOW 2 — production
export DATABASE_URL="<production>"
node --env-file=.env -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.hostname, u.pathname)'
# expect: ep-….neon.tech /neondb
```

**Window 2 commands take `--remote`.** Window 1 commands do not — and will refuse
if that window turns out to be pointed at production after all.

---

## 1. The five commands

```bash
npm run factors:select -- --material corrugated --activity-id paper_and_cardboard-type_board_primary_material_production --selected-by "Akshay Tandon" --licence-note "OGL v3.0 — copy/publish/distribute/adapt with Crown copyright attribution" --permit-value-display --notes "BEIS material use, primary material production, cradle-to-gate GB. Considered and rejected: ICM corrugated board base papers (0.842-1.21, CC-BY) — AU 2019 and cradle_to_shelf, a wider boundary than this report claims. ICE paper/board — not present in Climatiq; ICE removed from consideration entirely, non-educational use not permitted after 2026-09-30. Recycled content not modelled yet: primary row is the conservative end, blend rule is a post-Tuesday commit."
```

```bash
npm run factors:select -- --material plastic --activity-id plastics_rubber-type_pet_including_forming_primary_material_production --selected-by "Akshay Tandon" --licence-note "OGL v3.0 — copy/publish/distribute/adapt with Crown copyright attribution" --permit-value-display --notes "BEIS material use, primary material production, cradle-to-gate GB. Stands for all plastic components: PET strap is the heavier plastic item in both packs that contain one. Considered and rejected: LDPE and LLDPE primary production (2.96508) — same BOM key, would supersede this; ICM packaging film LDPE (3.14, CC-BY) — AU 2019 and cradle_to_shelf. ICE has no plastics rows and is removed from consideration. Recycled content not modelled yet; blend rule is a post-Tuesday commit."
```

```bash
npm run factors:select -- --material wood_solid --activity-id timber_forestry-type_wood_primary_material_production --selected-by "Akshay Tandon" --licence-note "OGL v3.0 — copy/publish/distribute/adapt with Crown copyright attribution" --permit-value-display --notes "LABELLED PROXY, not a match: BEIS publishes one generic wood row and does not distinguish sawn softwood. Considered and rejected: ICE v3 Timber - Softwood (0.263) — ICE removed from consideration, non-educational use not permitted after 2026-09-30 and no distribution of derived works to unregistered parties, which a public passport would be. Sanity check: BEIS generic wood 0.2695 is within 2.5 percent of the ICE softwood figure it replaces."
```

```bash
npm run factors:select -- --material wood_processed --activity-id timber_forestry-type_wood_primary_material_production --selected-by "Akshay Tandon" --licence-note "OGL v3.0 — copy/publish/distribute/adapt with Crown copyright attribution" --permit-value-display --notes "LABELLED PROXY, not a match: BEIS publishes one generic wood row covering wood generally, with no plywood or particle-board row. Considered and rejected: ICE v3 Timber - Plywood (0.682 cradle-to-gate) — ICE removed from consideration, licence blocks commercial use after 2026-09-30; its -0.933 carbon-storage variant is refused by the selector in any case. MUF presswood has no public row at all and awaits a Fitsol primary factor; it shares this BOM key, so do not run --none for it."
```

```bash
npm run factors:select -- --material metal --activity-id metals-type_primary_material_production --selected-by "Akshay Tandon" --licence-note "OGL v3.0 — copy/publish/distribute/adapt with Crown copyright attribution" --permit-value-display --notes "LABELLED PROXY, not a match: BEIS publishes no steel primary-material-production row. Its only steel-specific row is metal_products-type_steel_cans_closed_loop_source, which is closed-loop (recycled-content) and not comparable with the primary rows used for every other material here. This generic Metals primary-material-production row is used instead, and covers the golden pack 200 g of nails. Also considered and rejected: metals-type_basic_iron_and_steel — spend-based (kg/gbp), which the unit guard refuses because it cannot be converted to a per-kg factor; metals-type_scrap_metal_primary_material_production (3.47091) — scrap is a different input stream from new fasteners."
```

### Expected output per command

```
  Converted from 1198.23866 kg/tonne (÷ 1000) to kgCO2e/kg.
  using BEIS 2026 (GB).
  the provider also publishes this id for: 2025, 2024, … — pin one with --year.
selected secondary: corrugated/production v1 (#1) — 1.19823866 kgCO2e/kg · BEIS / …
```

Values you should see after conversion:

| BOM material | activity_id | kgCO2e/kg |
|---|---|---|
| `corrugated` | `paper_and_cardboard-type_board_primary_material_production` | 1.19824 |
| `plastic` | `plastics_rubber-type_pet_including_forming_primary_material_production` | 3.86158 |
| `wood_solid` | `timber_forestry-type_wood_primary_material_production` | 0.269504 |
| `wood_processed` | `timber_forestry-type_wood_primary_material_production` | 0.269504 |
| `metal` | `metals-type_primary_material_production` | 3.82195 |

Check with `npm run factors:list`.

---

### Window 2 (production): the same five, each with `--remote`

Identical commands, with `--remote` appended. The flag is the only difference —
everything else, including the notes, must be verbatim so both stores agree.

```bash
npm run factors:select -- --material corrugated --activity-id paper_and_cardboard-type_board_primary_material_production ... --remote
npm run factors:select -- --material plastic    --activity-id plastics_rubber-type_pet_including_forming_primary_material_production ... --remote
npm run factors:select -- --material wood_solid --activity-id timber_forestry-type_wood_primary_material_production ... --remote
npm run factors:select -- --material wood_processed --activity-id timber_forestry-type_wood_primary_material_production ... --remote
npm run factors:select -- --material metal      --activity-id metals-type_primary_material_production ... --remote
```

(`...` stands for the `--selected-by` / `--licence-note` / `--permit-value-display`
/ `--notes` arguments exactly as written above — copy each full command from §1 and
append `--remote`.)

---

## 2. The superseded alternatives — run only if you prefer them

Each **replaces** the §1 selection for that BOM key (appends a higher version).

```bash
# kraft label instead of board, for ALL corrugated components
npm run factors:select -- --material corrugated --activity-id paper_and_cardboard-type_paper_primary_material_production --selected-by "Akshay Tandon" --licence-note "OGL v3.0 — copy/publish/distribute/adapt with Crown copyright attribution" --permit-value-display --notes "Supersedes the board factor for every corrugated component. BEIS Paper, primary material production, cradle-to-gate GB, 1.34359 kgCO2e/kg."
```

```bash
# LDPE film instead of PET, for ALL plastic components
npm run factors:select -- --material plastic --activity-id plastics_rubber-type_ldpe_and_lldpe_including_forming_primary_material_production --selected-by "Akshay Tandon" --licence-note "OGL v3.0 — copy/publish/distribute/adapt with Crown copyright attribution" --permit-value-display --notes "Supersedes the PET factor for every plastic component. BEIS LDPE and LLDPE including forming, primary material production, cradle-to-gate GB, 2.96508 kgCO2e/kg."
```

**MUF presswood:** the Fitsol primary file
(`reference/fitsol_primary_factors.csv`) has a header and **no rows**, so there is
nothing to load. Do **not** run `--material wood_processed --none` for it: that
would replace the plywood proxy, and an absent factor already renders exactly as
`none` does. Add a row to the CSV when you have one, then:

```bash
npm run factors:select -- --primary-file reference/fitsol_primary_factors.csv --selected-by "Akshay Tandon"
```

---

## 3. Run it all again against production, then re-seed both

Merging a branch ships **code**, never factors. The stores are separate.

**An exported `DATABASE_URL` wins over `.env`.** Verified on Node 24.4.1: neither
`--env-file` nor `process.loadEnvFile()` overwrites a variable already present in
the environment. That is what makes §0 necessary in *both* directions.

```bash
# window 1 — local
npm run factors:list          # confirm the five rows
npm run seed:demo-suite

# window 2 — production, after the same five selections (each with --remote)
npm run factors:list
npm run seed:demo-suite -- --remote
```

**The re-seed is required, not cosmetic.** `assessments.factors_pinned_at` is
first-evaluation-wins: any demo pack whose report has already been opened is
pinned to the *empty* factor set and will keep rendering "No factor selected"
however many factors you select afterwards. Re-seeding recreates the packs
unpinned. At the time of writing, `Demo — corrugated export carton` is in exactly
that state locally.

Then open each demo report and confirm the footprint card shows a real total with
`BEIS / Greenhouse gas reporting: conversion factors 2026 · GB · 2026 · Secondary
database` per row, and **no "partial" flag on any of the three demo packs** — with `metal` selected,
every demo component now resolves.


---

## Appendix — after the Passport v3-lite merge (Sprint 10)

Passport v3-lite changes the passport PAYLOAD (proof, issuers, component
traceability, rule-set provenance). Existing passports keep parsing and keep
verifying against their stored hashes — the new fields are optional — but they do
**not** show the new sections until they are regenerated.

Two OWNER actions after the PR merges, both against production:

```bash
npm run seed:demo-suite -- --remote
```

Then open each demo report once and press **Generate passport**, which mints a new
hash-chained version carrying the new payload.

**This orphans any passport QR generated before the merge** — the token is stable,
so an old QR still resolves, but a passport minted earlier renders without the new
sections until regenerated. That was accepted when the sprint was scoped.

Local is already done: `npm run seed:demo-suite` and regeneration were run as part
of the sprint.

---

## Appendix B — closed-loop rows for the recycled-content blend (Sprint 12)

The blend is `factor = primary × (1 − r) + closed_loop × r`, with `r` the
component's recycled share. It needs a SECOND row per material, stored under
`--process production_closed_loop` so it sits alongside the primary row rather
than superseding it. **Both rows are pinned**, so a screening reproduces its blend
from pinned values even after either factor is re-selected.

Until these are selected, every component renders `… BEIS primary only — no
closed-loop factor selected for this material`, and **no figure changes**.

All four rows are BEIS 2026 GB, `cradle_to_gate`, under OGL v3.0 — same licence,
same year-pinning as the primary rows.

### Local (window 1)

```bash
npm run factors:select -- --material corrugated --process production_closed_loop --activity-id paper_and_cardboard-type_board_closed_loop_source --selected-by "Akshay Tandon" --licence-note "OGL v3.0 — copy/publish/distribute/adapt with Crown copyright attribution" --permit-value-display --notes "Closed-loop (recycled-source) counterpart to the corrugated primary row, for the recycled-content blend. BEIS material use, cradle-to-gate GB 2026, 1096.62766 kg/tonne."
```

```bash
npm run factors:select -- --material plastic --process production_closed_loop --activity-id plastics_rubber-type_pet_including_forming_closed_loop_source --selected-by "Akshay Tandon" --licence-note "OGL v3.0 — copy/publish/distribute/adapt with Crown copyright attribution" --permit-value-display --notes "Closed-loop counterpart to the PET primary row, for the recycled-content blend. BEIS material use, cradle-to-gate GB 2026, 2211.58251 kg/tonne."
```

### Production (window 2) — same two, each with `--remote`

Append `--remote` to each command above. Nothing else changes.

### Expected values after conversion

| BOM material | activity_id | kgCO2e/kg |
|---|---|---|
| `corrugated` | `paper_and_cardboard-type_board_closed_loop_source` | 1.09662766 |
| `plastic` | `plastics_rubber-type_pet_including_forming_closed_loop_source` | 2.21158251 |

`factors:list` should then show **four** rows for these two materials — a
`production` and a `production_closed_loop` each.

### Wood and metals — asked for, and here is what BEIS actually publishes

**Metals: a usable row exists.** `metals-type_closed_loop_source`, 1636.68994
kg/tonne → **1.63668994 kgCO2e/kg**, GB 2026. This one matters for the demo: the
golden pack's nails state **62% recycled**, so selecting it changes that
component from 0.764 to about 0.497 kg CO2e and moves the pack total. Not printed
above because it was not in the brief — decide deliberately, then:

```bash
npm run factors:select -- --material metal --process production_closed_loop --activity-id metals-type_closed_loop_source --selected-by "Akshay Tandon" --licence-note "OGL v3.0 — copy/publish/distribute/adapt with Crown copyright attribution" --permit-value-display --notes "Closed-loop counterpart to the generic metals primary row. BEIS 2026 GB, 1636.68994 kg/tonne. Also available and NOT chosen: metal_products-type_steel_cans_closed_loop_source (1821.58251) and metals-type_scrap_metal_closed_loop_source (1704.27272)."
```

**⚠️ Wood: a row exists and it is ZERO.**
`timber_forestry-type_wood_closed_loop_source` is published at **0 kg/tonne**, GB
2026 — BEIS attributes no production burden to a closed-loop wood source. Selecting
it would mean a wood component at `r = 1` costs **0 kg CO2e**, and at `r = 0.5`
costs half the primary. That is faithful to BEIS and reads on a customer's report
like a bug.

**Recommendation: do not select it** without deciding what you want a 100%-recycled
wood component to say. No demo component is affected — the pine pallet states no
recycled share — so nothing is lost by leaving it.
