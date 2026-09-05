-- Batch 2 (EU) — all DRAFT. Member-State EPR-registration layer (jurisdiction MS),
-- France national labelling (Stack C), the EU green-claims framework (Stack C),
-- and the two 2030 PPWR forward rows referenced by the golden fixtures.
--
-- Citations point to PRIMARY law. National register names and 2030 numeric
-- values are NOT confirmed against primary here — those rows carry a TODO and
-- leave thresholds empty (no guessed values). Two engine/schema gaps are flagged
-- in notes, to be PROPOSED before migrating (not improvised):
--   (1) per-Member-State applies_when (applies when <MS> is among destinations);
--   (2) recurring-obligation "next-due" semantics for filing cadence.

INSERT INTO checkpoints (
  id, version, geography, jurisdiction_level, stack, subject, material, legal_role,
  persona_relevance, packaging_level, trigger_date, sunset_date, status,
  requirement_text, thresholds, evidence_requirements, applies_when, test_method,
  citation, citation_verified_date, notes
) VALUES

-- 1. DE registration
('EU-MS-DE-epr-registration', 1, 'DE', 'MS', 'B', 'organisation', '{all}', '{epr_producer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
 'Register as a producer in Germany''s national packaging register LUCID (Zentrale Stelle Verpackungsregister) and license quantities with a dual system; appoint an authorised representative where the producer is not established in Germany. Filing cadence: data reports as prescribed under the VerpackG.',
 NULL, '{"allOf":[{"anyOf":["registration"]}]}', '{"destination_member_states":"present"}', NULL,
 'Regulation (EU) 2025/40, Article 44 (registration of producers). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
 NULL,
 'SUBJECT: organisation. Register = LUCID / ZSVR under the German VerpackG. TODO: confirm the national legal basis pinpoint on primary. applies_when set to destination present — per-MS applies_when (applies when DE in destinations) needs an engine enhancement (proposed, not improvised). Filing cadence is descriptive only — recurring next-due semantics need a schema proposal.'),

-- 2. FR registration
('EU-MS-FR-epr-registration', 1, 'FR', 'MS', 'B', 'organisation', '{all}', '{epr_producer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
 'Register with the French producer register held by ADEME (SYDEREP) and adhere to an approved éco-organisme (e.g. CITEO); appoint an authorised representative where not established in France. Filing cadence: annual declarations as prescribed under the Code de l''environnement / AGEC.',
 NULL, '{"allOf":[{"anyOf":["registration"]}]}', '{"destination_member_states":"present"}', NULL,
 'Regulation (EU) 2025/40, Article 44 (registration of producers). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
 NULL,
 'SUBJECT: organisation. Register = ADEME/SYDEREP; éco-organisme CITEO. TODO: confirm the national legal basis (Code de l''environnement) pinpoint on primary. Per-MS applies_when + recurring next-due: see enhancement proposals.'),

-- 3. ES registration
('EU-MS-ES-epr-registration', 1, 'ES', 'MS', 'B', 'organisation', '{all}', '{epr_producer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
 'Register in the Spanish register of packaging producers (Registro de Productores de Producto — sección envases) and join a collective/individual EPR scheme; appoint an authorised representative where not established in Spain. Filing cadence as prescribed nationally.',
 NULL, '{"allOf":[{"anyOf":["registration"]}]}', '{"destination_member_states":"present"}', NULL,
 'Regulation (EU) 2025/40, Article 44 (registration of producers). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
 NULL,
 'SUBJECT: organisation. Register per Real Decreto 1055/2022 (envases). TODO: confirm national legal basis pinpoint on primary. Per-MS applies_when + recurring next-due: see enhancement proposals.'),

-- 4. IT registration
('EU-MS-IT-epr-registration', 1, 'IT', 'MS', 'B', 'organisation', '{all}', '{epr_producer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
 'Register and participate in the Italian packaging EPR system (CONAI / material consortia) as required; appoint an authorised representative where not established in Italy. Filing cadence as prescribed nationally.',
 NULL, '{"allOf":[{"anyOf":["registration"]}]}', '{"destination_member_states":"present"}', NULL,
 'Regulation (EU) 2025/40, Article 44 (registration of producers). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
 NULL,
 'SUBJECT: organisation. Scheme = CONAI under D.Lgs. 152/2006. TODO: confirm national legal basis pinpoint on primary. Per-MS applies_when + recurring next-due: see enhancement proposals.'),

-- 5. NL registration
('EU-MS-NL-epr-registration', 1, 'NL', 'MS', 'B', 'organisation', '{all}', '{epr_producer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
 'Register with the Dutch packaging producer scheme (Afvalfonds Verpakkingen) and file packaging declarations; appoint an authorised representative where not established in the Netherlands. Filing cadence as prescribed nationally.',
 NULL, '{"allOf":[{"anyOf":["registration"]}]}', '{"destination_member_states":"present"}', NULL,
 'Regulation (EU) 2025/40, Article 44 (registration of producers). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
 NULL,
 'SUBJECT: organisation. Scheme = Afvalfonds Verpakkingen. TODO: confirm national legal basis pinpoint on primary. Per-MS applies_when + recurring next-due: see enhancement proposals.'),

-- 6. PL registration
('EU-MS-PL-epr-registration', 1, 'PL', 'MS', 'B', 'organisation', '{all}', '{epr_producer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
 'Register in the Polish BDO database (Baza danych o produktach i opakowaniach) and meet recovery/recycling obligations; appoint an authorised representative where not established in Poland. Filing cadence as prescribed nationally.',
 NULL, '{"allOf":[{"anyOf":["registration"]}]}', '{"destination_member_states":"present"}', NULL,
 'Regulation (EU) 2025/40, Article 44 (registration of producers). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
 NULL,
 'SUBJECT: organisation. Register = BDO. TODO: confirm national legal basis pinpoint on primary. Per-MS applies_when + recurring next-due: see enhancement proposals.'),

-- 7. France product labelling (Stack C)
('EU-MS-FR-labelling-triman-infotri', 1, 'FR', 'MS', 'C', 'packaging_unit', '{all}', '{manufacturer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,ecomm}', '2026-08-12', NULL, 'draft',
 'Household packaging placed on the French market must display the Triman logo and the info-tri sorting signage (both together, printed or on a sticker); glass beverage containers are excluded.',
 NULL, '{"allOf":[{"anyOf":["marking"]}]}', '{"destination_member_states":"present"}', NULL,
 'France — Décret n° 2021-835 of 29 June 2021 on consumer sorting information (info-tri / Triman), implementing the AGEC law (Loi n° 2020-105, Art. 17). https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043714227',
 NULL,
 'SUBJECT: packaging_unit. FR national labelling. Applies to household packaging under EPR; excludes glass beverage containers. Per-MS applies_when (applies when FR in destinations) needs the engine enhancement. Confirm scope/exemptions on primary.'),

-- 8. EU green-claims substantiation (Stack C)
('EU-green-claims-substantiation', 1, 'EU', 'EU', 'C', 'packaging_unit', '{all}', '{manufacturer,importer,distributor}',
 '{1,2a,2b}', '{sales,inner,outer,ecomm}', '2026-09-27', NULL, 'draft',
 'Environmental claims and sustainability labels made on or about the packaging must be substantiated; generic environmental claims (e.g. "eco-friendly", "biodegradable") without recognised, relevant substantiation are prohibited, and future claims/labels require third-party verification.',
 NULL, '{"allOf":[{"anyOf":["technical_file"]}]}', NULL, NULL,
 'Directive (EU) 2024/825 (Empowering Consumers for the Green Transition), amending Directives 2005/29/EC and 2011/83/EU. https://eur-lex.europa.eu/eli/dir/2024/825/oj',
 NULL,
 'SUBJECT: packaging_unit. Applies where an environmental claim is made about the packaging (no BOM fact captures "a claim is made" — applicability is a manual/context input for now). Application date 27 Sep 2026; a Directive transposed nationally — TODO confirm transposition per Member State. Substantiation of green claims (EU Green Claims Directive proposal) may add to this once adopted.'),

-- 9. PPWR recyclability grade (2030 forward)
('EU-PPWR-recyclability-grade', 1, 'EU', 'EU', 'A', 'component', '{all}', '{manufacturer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2030-01-01', NULL, 'draft',
 'From 2030 packaging must meet design-for-recycling criteria and be assigned a recyclability grade (A/B/C) under delegated acts; below-grade packaging faces market restriction.',
 NULL, '{"allOf":[{"anyOf":["technical_file"]}]}', NULL, NULL,
 'Regulation (EU) 2025/40, Article 6 (recyclability). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
 NULL,
 'SUBJECT: component. FORWARD (2030). thresholds EMPTY — the 70% recyclability floor, grade thresholds and delegated-act dates are on the re-verify list; do not seed numeric values until confirmed on primary. TODO: pin Article 6 detail + delegated acts.'),

-- 10. PPWR recycled content in plastic (2030 forward)
('EU-PPWR-recycled-content-plastic', 1, 'EU', 'EU', 'B', 'component', '{plastic,all}', '{manufacturer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2030-01-01', NULL, 'draft',
 'From 2030 plastic packaging must contain a minimum share of recycled content, differentiated by contact sensitivity and application; a recycled-content certificate is required.',
 NULL, '{"allOf":[{"anyOf":["registration","technical_file"]}]}', NULL, NULL,
 'Regulation (EU) 2025/40, Article 7 (minimum recycled content in plastic packaging). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
 NULL,
 'SUBJECT: component. FORWARD (2030). thresholds EMPTY — the per-category recycled-content percentages are on the re-verify list; do not seed numeric values until confirmed on primary EUR-Lex text. TODO: pin Article 7 percentages and categories.');
