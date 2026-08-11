# Regulatory sources register

Provenance for every source the corpus relies on. **Primary law** (the `citation` field of a checkpoint — MANDATORY, article-level) is listed separately from **interpretive guidance** (recorded only in `notes`/`requirement_text`/`test_method`, never in `citation`). Retrieval dates matter: guidance is revised.

## Primary law

| Instrument | Source (primary) | Retrieved |
|---|---|---|
| Regulation (EU) 2025/40 (PPWR) | https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng | 2026-08-07 |

## Interpretive guidance (non-binding — never a `citation`)

| Source | Location | Retrieved | Notes |
|---|---|---|---|
| Commission PPWR FAQ, **2nd edition** (DG ENV, Unit B01, **Aug 2026**) | Official: https://environment.ec.europa.eu/publications/guidance-document-packaging-and-packaging-waste-regulation-ppwr_en · Mirror (industry, unofficial): https://ppwrcatoolkit-europen.eu/wp-content/uploads/2025/06/PPWR-FAQ-August-2026.pdf | 2026-08-10 | Updates/replaces the March 2026 1st edition (33 new/revised entries). **The exact official PDF deep-link on the EC domain was not pinned** — confirm on the EC publications page above before quoting a page/chapter. Source for Commit 9 amendments. |
| Commission Notice C/2026/3084 — PFAS verification framework | EUR-Lex (CELEX 52026XC3084 — **URL to confirm on primary**) | 2026-08-10 | Three-step framework: total-fluorine (TF) screening → py-GC/MS → TOP assay. Current reference for PFAS; **no defined Union-level conformity pathway**. Cited by `EU-PPWR-pfas-food-contact` test_method. |

## Test-method standards (referenced in `test_method`)

| Standard | Referenced by | Notes |
|---|---|---|
| CR 13695-1:2000 | `EU-PPWR-heavy-metals` | CEN — measurement/verification of the four heavy metals in packaging. Commission-recommended per FAQ. Paywalled (CEN/national body). |
| EN 13428:2004, Annex C | `EU-PPWR-soc-minimisation` | CEN — prevention by source reduction; reference method, presumption of conformity withdrawn. Paywalled. |

## How to use this register

- A checkpoint's `citation` must resolve to a row under **Primary law** (or an equivalent primary gazette/notification). Interpretive guidance supports the *reading* of a citation; it never replaces it.
- When guidance is superseded (e.g. a FAQ 3rd edition), add a new row with its retrieval date rather than editing the old one — corpus decisions made against the older reading must stay reproducible.
