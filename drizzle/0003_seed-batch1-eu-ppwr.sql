-- Batch 1 — EU Stack A / PPWR (Regulation (EU) 2025/40) checkpoints.
--
-- Every row is seeded status = 'draft'. Drafts cannot produce verdicts and
-- cannot reach 'in_force' without a regulatory-owner approval record (trigger,
-- migration 0001). This migration is the corpus data; the COMMIT MESSAGE is the
-- review queue — id, one-line requirement and citation URL per checkpoint.
--
-- Citations are article-level to Regulation (EU) 2025/40 with the EUR-Lex ELI
-- URL. citation_verified_date is NULL on every row: article/paragraph pinpoints
-- were cross-checked against discovery sources but NOT yet confirmed against the
-- primary enacting text (the EUR-Lex fetch returned only recitals). The approver
-- confirms each pinpoint via the URL before promotion — that verification is the
-- gate, not this seed.
--
-- Thresholds are the verified facts-ledger values, not guesses. PFAS carries
-- three simultaneous limits, which the single-object `threshold` type cannot
-- hold (schema-delta #8, threshold-as-list): its limits are stated in
-- requirement_text and threshold left NULL rather than store a shape that
-- contradicts the declared type. Pack/consignment-level rows note SUBJECT in
-- `notes` pending schema-delta #2 (checkpoint `subject` column) — not added
-- here, as that decision is still open.

INSERT INTO checkpoints (
  id, version, geography, jurisdiction_level, stack, material, legal_role,
  persona_relevance, packaging_level, trigger_date, sunset_date, status,
  requirement_text, threshold, evidence_type, test_method, citation,
  citation_verified_date, notes, food_contact_only
) VALUES

-- 1. Heavy metals
(
  'EU-PPWR-heavy-metals', 1, 'EU', 'EU', 'A', '{all}', '{manufacturer,importer}',
  '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
  'The sum of concentration levels of lead, cadmium, mercury and hexavalent chromium present in packaging or any packaging component shall not exceed 100 mg/kg.',
  '{"parameter":"Pb+Cd+Hg+Cr(VI) sum","operator":"<=","value":100,"unit":"mg/kg"}'::jsonb,
  '{supplier_declaration,test_report,lab_test}', 'XRF screening / accredited heavy-metals test (confirm method reference)',
  'Regulation (EU) 2025/40, Article 5 (restrictions on substances in packaging) — sum of Pb, Cd, Hg, Cr(VI). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  NULL,
  'SUBJECT: component. 100 mg/kg sum from verified facts ledger. Confirm Article 5 paragraph pinpoint (checklist artefact indicates Art 5(4)) against primary text before approval.',
  false
),

-- 2. PFAS in food-contact packaging
(
  'EU-PPWR-pfas-food-contact', 1, 'EU', 'EU', 'A', '{all}', '{manufacturer,importer}',
  '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
  'Food-contact packaging shall not be placed on the market where PFAS are present above: 25 ppb for any single PFAS (targeted analysis); 250 ppb for the sum of PFAS (targeted, non-polymeric); and 50 ppm for total organic fluorine.',
  NULL,
  '{lab_test,test_report}', 'Targeted PFAS analysis + total organic fluorine determination (confirm method)',
  'Regulation (EU) 2025/40, Article 5 (PFAS restriction in food-contact packaging). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  NULL,
  'SUBJECT: component. FOOD-CONTACT ONLY. Three simultaneous limits — structured threshold pending schema-delta #8 (threshold-as-list); stated in requirement_text instead. Values from verified facts ledger; confirm Article 5 PFAS pinpoint and units against primary text.',
  true
),

-- 3. Substances of concern — minimisation
(
  'EU-PPWR-soc-minimisation', 1, 'EU', 'EU', 'A', '{all}', '{manufacturer,importer}',
  '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
  'Substances of concern present in packaging or packaging components shall be minimised. A substances-of-concern statement shall cover inks, adhesives, coatings and any added functional substances (e.g. VCI additives).',
  NULL,
  '{supplier_declaration}', NULL,
  'Regulation (EU) 2025/40, Article 5 (minimisation of substances of concern). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  NULL,
  'SUBJECT: component. Confirm Article 5(1) pinpoint against primary text.',
  false
),

-- 4. No chemical wood preservative
(
  'EU-PPWR-no-chemical-preservative', 1, 'EU', 'EU', 'A', '{wood}', '{manufacturer,importer}',
  '{1,2a,2b}', '{transport,pallet,outer}', '2026-08-12', NULL, 'draft',
  'Solid-wood packaging shall not be treated with chemical wood preservatives (e.g. CCA), which would breach the heavy-metals restriction via hexavalent chromium. A no-preservative / heat-treatment-only declaration is required.',
  NULL,
  '{supplier_declaration}', NULL,
  'Regulation (EU) 2025/40, Article 5 (restrictions on substances). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  NULL,
  'SUBJECT: component. Links EU-PPWR-heavy-metals. Confirm Article 5 pinpoint.',
  false
),

-- 5. Composite ≥5% plastic treated as plastic-relevant
(
  'EU-PPWR-composite-plastic-relevant', 1, 'EU', 'EU', 'A', '{all}', '{manufacturer,importer}',
  '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
  'Composite packaging containing 5% or more plastic by weight is treated as plastic for the purposes of plastic-specific requirements.',
  '{"parameter":"plastic content by weight","operator":">=","value":5,"unit":"% w/w"}'::jsonb,
  '{supplier_declaration,technical_file}', NULL,
  'Regulation (EU) 2025/40, Article 3 (definitions) / material classification — composite >=5% plastic. https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  NULL,
  'SUBJECT: component. Classification rule (not an Article 5 substance limit). Confirm definitions/material-category pinpoint against primary text.',
  false
),

-- 6. Technical documentation (Annex VII, Module A)
(
  'EU-PPWR-technical-documentation', 1, 'EU', 'EU', 'A', '{all}', '{manufacturer}',
  '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
  'The manufacturer shall compile technical documentation per Annex VII (internal production control, Module A) for every packaging specification, covering material specifications, weights, drawings/photographs, declarations and test reports.',
  NULL,
  '{technical_file}', NULL,
  'Regulation (EU) 2025/40, Article 38 (conformity assessment, Module A) and Annex VII (technical documentation). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  NULL,
  'SUBJECT: pack — pending schema-delta #2 (checkpoint subject column). Module A procedure = Article 38; technical documentation = Annex VII. Confirm Article 38 pinpoint.',
  false
),

-- 7. EU declaration of conformity (Annex VIII) — USER obligation
(
  'EU-PPWR-declaration-of-conformity', 1, 'EU', 'EU', 'A', '{all}', '{manufacturer,importer}',
  '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
  'The obligated economic operator shall draw up and sign an EU declaration of conformity per Annex VIII before placing the packaging on the market, and shall retain it for 5 years for single-use packaging and 10 years for reusable packaging. Compiling and issuing the declaration is the operator''s obligation.',
  NULL,
  '{technical_file}', NULL,
  'Regulation (EU) 2025/40, Article 39 and Annex VIII (EU declaration of conformity). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  NULL,
  'SUBJECT: pack — pending delta #2. Wording states the DoC as the USER''s obligation by design — the system never issues one. No evidence_type for a declaration in the current vocabulary (using technical_file; see delta #6, action-type vocabulary). Article 39 corroborated by discovery search; confirm against primary text.',
  false
),

-- 8. Operator identification marking
(
  'EU-PPWR-operator-identification', 1, 'EU', 'EU', 'A', '{all}', '{manufacturer,importer}',
  '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
  'The name, registered trade name or trademark and postal address of the manufacturer and of the importer shall be marked on the packaging (or, where size does not allow, on accompanying documentation).',
  NULL,
  '{marking}', NULL,
  'Regulation (EU) 2025/40 — economic-operator identification/marking (Article to be confirmed). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  NULL,
  'SUBJECT: pack — pending delta #2. ARTICLE PINPOINT NOT CONFIRMED — recital 79 references importer indication of name/address; confirm the economic-operator-obligations article against primary text before approval.',
  false
),

-- 9. EPR producer registration (Article 44)
(
  'EU-EPR-producer-registration', 1, 'EU', 'MS', 'B', '{all}', '{epr_producer,importer}',
  '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
  'The producer shall register in the national producer register of each Member State where packaging or packaged products are made available for the first time; an authorised representative shall be appointed where required. A branch office does not qualify as importer.',
  NULL,
  '{registration}', NULL,
  'Regulation (EU) 2025/40, Article 44 (registration of producers). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  NULL,
  'SUBJECT: consignment/market — pending delta #2. STACK B (EPR) though seeded in Batch 1 per instruction. Article 44 corroborated by discovery search; registration executed per Member State. Confirm against primary text.',
  false
),

-- 10. No transitional stock (application from 12 Aug 2026)
(
  'EU-PPWR-no-transitional-stock', 1, 'EU', 'EU', 'A', '{all}', '{manufacturer,importer,distributor}',
  '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
  'Packaging placed on the market on or after 12 August 2026 shall comply with this Regulation regardless of its date of manufacture; there is no placed-on-market grace period for pre-existing stock.',
  NULL,
  '{technical_file}', NULL,
  'Regulation (EU) 2025/40 — application from 12 August 2026 (confirm application/entry-into-application article). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  NULL,
  'SUBJECT: consignment. Applicability/scope rule. Confirm application-date article against primary text.',
  false
);
