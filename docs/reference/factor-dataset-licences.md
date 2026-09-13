# Emission-factor dataset licences — what each permits

Fetched 2026-09-13. One entry per dataset that appeared in the public Climatiq
shortlists for the demo materials (`npm run factors:candidates -- --all`).

The question each entry answers is narrow and specific: **may the factor VALUE be
republished on a public page?** That is what `emission_factors.value_display_permitted`
records, and it is the difference between a passport that shows
`0.682 kgCO2e/kg` and one that shows only the computed result and the dataset
name.

These are readings of the terms as published on the dates below. They are
**input to the owner's decision, not the decision** — `factors:select` still
requires `--licence-note` and an explicit `--permit-value-display`, because
accepting a licence is a human act.

---

## BEIS / DESNZ — "Greenhouse gas reporting: conversion factors"

- Source: <https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024>
- Licence: **Open Government Licence v3.0** — "All content is available under the
  Open Government Licence v3.0, except where otherwise stated."
- Permits: copying, publishing, distributing and adapting the data.
- Requires: attribution to the Crown copyright holder.

**Value republication: PERMITTED.** OGL v3.0 explicitly covers publishing and
distributing. Attribution is the only condition.

Suggested `--licence-note`:
> "OGL v3.0 (gov.uk) — copy/publish/distribute/adapt permitted with Crown copyright attribution. Read 2026-09-13."

---

## ICM Database — Integrated Carbon Metrics Embodied Carbon LCI (UNSW / CRCLCL)

- Source: <https://unsworks.unsw.edu.au/entities/dataset/abbeea2d-0679-45c5-aeb7-54338cafeb08>
- Licence: **CC-BY** (Creative Commons Attribution 4.0). Copyright 2019, CRCLCL.
  Designated **open access**.
- Permits: sharing and adapting, including commercially.
- Requires: appropriate credit to CRCLCL.

**Value republication: PERMITTED with attribution.**

Note separately: every ICM row in the shortlists carries Climatiq's
`notable_methodological_variance` flag, is **Australian (AU)**, dated **2019**, and
is `cradle_to_shelf` rather than `cradle_to_gate` — a wider boundary than the
report's own label claims. That is a data-fit question, not a licence one, but it
belongs in the same decision.

Suggested `--licence-note`:
> "CC-BY 4.0, open access (UNSW/CRCLCL) — share and adapt permitted with credit to CRCLCL. Read 2026-09-13."

---

## ICE Database v3 — Circular Ecology ⚠️

- Source: <https://circularecology.com/embodied-carbon-footprint-database.html>
- Requires: attribution to Circular Ecology **and a link to the official download
  page**.

**⚠️ This is not an attribution-only dataset. Two restrictions bear directly on
using it in a commercial product:**

1. **"Non-educational use of ICE Database data will no longer be permitted after
   30th September 2026."** The ICE Database Educational is "strictly for
   educational purposes only, and no commercial use of the database or its
   derivatives is permitted." Educational purposes are enumerated as learning,
   teaching, student exercises, educational presentations, training courses, and
   viewing/browsing — a customer-facing compliance screening is none of these.
2. Registered users of the **Advanced** (non-educational) version "must not
   distribute the Database or its derived works to unregistered parties outside
   of their organisation without explicit written permission." A public passport
   showing an ICE value is distribution to unregistered parties.

Circular Ecology offers **IC+** as the licensed route for ongoing professional and
commercial use: <https://circularecology.com/ic-plus.html>

**Value republication: NOT on the strength of the public page.** Treat ICE as
blocked for commercial use from **2026-09-30** unless an IC+ (or equivalent
written) licence is in place — and even under the Advanced terms, public
redistribution needs explicit written permission.

This affects the two wood factors in the shortlist directly:
`timber_forestry-type_timber_softwood` (0.263) and
`timber_forestry-type_timber_plywood` (0.682).

---

## Other datasets that appeared in the shortlists

Not read in depth, because none is a leading candidate for the demo materials.
Read the terms before selecting any of them.

| Dataset | Terms URL | Note |
|---|---|---|
| Bafa — Informationsblatt CO2-Faktoren v3.3 | <https://www.bafa.de/SharedDocs/Downloads/DE/Energie/eew_infoblatt_co2_faktoren_2025.html> | German federal publication, 2025; DE region |
| ADEME — Base Carbone | <https://base-empreinte.ademe.fr/donnees/download-data> | Several rows report boundary `unknown` — not usable as cradle-to-gate without checking |
| CAEP — China Products Carbon Footprint Factors | <http://www.caep.org.cn/ywdt/zhxx/202201/t20220105_1154250.html> | CN region, 2022 |
| Plastics Europe — Public LCI | <https://plasticseurope.lca-data.com/processList.xhtml> | EUROPE region but **2013** — the oldest candidate in the set |
| Climatiq — Materials | <https://www.climatiq.io/methodology#Climatiq-emission-factors> | Climatiq's own derived factors |
| EPA / Cornerstone — GHG Emission Factors Hub | <https://www.epa.gov/climateleadership/ghg-emission-factors-hub> | Only `end_of_life` rows surfaced — not production factors |
