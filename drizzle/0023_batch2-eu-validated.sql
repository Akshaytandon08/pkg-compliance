-- Ingest the nine validated Batch 2 EU rows (docs/batch2-eu-validated.md).
-- All rows are draft v1 (never approved), so they advance to draft v2 IN PLACE
-- (no approved history to preserve; no checkpoint_approvals/guidance reference
-- them). Content stays DRAFT — approval remains human-only. New validation-report
-- fields (migration 0022) are populated here.

-- 1. EU-PPWR-recyclability-grade -----------------------------------------------
UPDATE checkpoints SET
  version = 2,
  requirement_text = 'From the applicable date, packaging must be designed for recycling and assigned a recyclability performance grade by weight: Grade A (at least 95% of the unit recyclable), Grade B (at least 80%), or Grade C (at least 70%), under the design-for-recycling criteria set by delegated act. Packaging that does not reach Grade C (below 70% recyclable by weight) may not be placed on the market.',
  thresholds = '[{"parameter":"recyclability grade A","operator":">=","value":95,"unit":"% by weight"},{"parameter":"recyclability grade B","operator":">=","value":80,"unit":"% by weight"},{"parameter":"recyclability grade C","operator":">=","value":70,"unit":"% by weight"}]'::jsonb,
  later_of_condition = '24 months after the Article 6(4) delegated acts (design-for-recycling criteria), or 5 years after the Article 6(5) implementing acts (recycled-at-scale assessment), whichever is later.',
  citation = 'Regulation (EU) 2025/40, Article 6(2)-(5) and Annex II, Table 3. https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  source_corroborating = 'https://environment.ec.europa.eu/topics/waste-and-recycling/packaging-waste_en',
  confidence = 'H',
  notes = 'Validated (docs/batch2-eu-validated.md). Grade thresholds A/B/C by weight; phase-in governed by later_of_condition. FORWARD row — draft.'
  WHERE id = 'EU-PPWR-recyclability-grade' AND version = 1;
--> statement-breakpoint

-- 2. EU-PPWR-recycled-content-plastic ------------------------------------------
UPDATE checkpoints SET
  version = 2,
  requirement_text = 'From the applicable date, plastic packaging must contain a minimum share of post-consumer recycled plastic content, calculated as an average per manufacturing plant and per year, differentiated by packaging category and contact sensitivity.',
  thresholds = '[{"parameter":"contact-sensitive plastic packaging made from PET","operator":">=","value":30,"unit":"% post-consumer recycled content","applies_when":"from 2030"},{"parameter":"contact-sensitive plastic packaging other than PET","operator":">=","value":10,"unit":"% post-consumer recycled content","applies_when":"from 2030"},{"parameter":"single-use plastic beverage bottles","operator":">=","value":30,"unit":"% post-consumer recycled content","applies_when":"from 2030"},{"parameter":"other plastic packaging","operator":">=","value":35,"unit":"% post-consumer recycled content","applies_when":"from 2030"},{"parameter":"contact-sensitive plastic packaging made from PET","operator":">=","value":50,"unit":"% post-consumer recycled content","applies_when":"from 2040"},{"parameter":"contact-sensitive plastic packaging other than PET","operator":">=","value":25,"unit":"% post-consumer recycled content","applies_when":"from 2040"},{"parameter":"single-use plastic beverage bottles","operator":">=","value":65,"unit":"% post-consumer recycled content","applies_when":"from 2040"},{"parameter":"other plastic packaging","operator":">=","value":65,"unit":"% post-consumer recycled content","applies_when":"from 2040"}]'::jsonb,
  later_of_condition = '3 years after the Article 7(8) implementing act (calculation and verification methodology).',
  exemptions = '[{"scope":"Compostable plastic packaging","basis_pinpoint":"Regulation (EU) 2025/40, Art 7(4)"},{"scope":"Immediate packaging of medicinal products (human/veterinary)","basis_pinpoint":"Art 7(4)"},{"scope":"Immediate packaging of medical devices and in-vitro diagnostics","basis_pinpoint":"Art 7(4)"},{"scope":"Contact-sensitive packaging of foods for infants and young children and foods for special medical purposes","basis_pinpoint":"Art 7(4)"},{"scope":"Packaging for the transport of dangerous goods","basis_pinpoint":"Art 7(4)"},{"scope":"Recycled content that would conflict with food-contact or health-and-safety requirements","basis_pinpoint":"Art 7(5)"},{"scope":"Plastic parts each representing less than 5% of the total weight of the packaging unit","basis_pinpoint":"Art 7(5)"}]'::jsonb,
  citation = 'Regulation (EU) 2025/40, Article 7(1)-(5) and (8). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  source_corroborating = 'https://environment.ec.europa.eu/topics/waste-and-recycling/packaging-waste_en',
  confidence = 'H',
  notes = 'Validated (docs/batch2-eu-validated.md). 2030 and 2040 minima per category; post-consumer, per manufacturing plant. Exemptions Art 7(4)/(5). FORWARD row — draft.'
  WHERE id = 'EU-PPWR-recycled-content-plastic' AND version = 1;
--> statement-breakpoint

-- 3. EU-green-claims-substantiation --------------------------------------------
UPDATE checkpoints SET
  version = 2,
  requirement_text = 'Environmental claims and sustainability labels made on or about the packaging must be substantiated on recognised and relevant evidence. Generic environmental claims made without recognised excellent environmental performance relevant to the claim are prohibited, and sustainability labels must be based on a certification scheme or established by a public authority.',
  citation = 'Directive (EU) 2024/825, Article 4; new UCPD (Directive 2005/29/EC) Annex I points 2(a), 4(a) and 4(b). https://eur-lex.europa.eu/eli/dir/2024/825/oj',
  source_corroborating = 'https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-protection-cooperation-network/empowering-consumers-green-transition_en',
  confidence = 'H',
  notes = 'Validated (docs/batch2-eu-validated.md). Enforcement via national transposition; Member States apply from 27 Sep 2026. Applicability (a claim is made) is a manual/context input.'
  WHERE id = 'EU-green-claims-substantiation' AND version = 1;
--> statement-breakpoint

-- 4. EU-MS-DE-epr-registration -------------------------------------------------
UPDATE checkpoints SET
  version = 2,
  citation = 'Verpackungsgesetz (VerpackG), Paragraphs 6, 7 and 9. https://www.gesetze-im-internet.de/verpackg/',
  official_register = 'LUCID (Verpackungsregister)',
  register_operator = 'Zentrale Stelle Verpackungsregister (ZSVR)',
  source_corroborating = 'https://www.verpackungsregister.org/',
  confidence = 'H',
  notes = 'Validated (docs/batch2-eu-validated.md). Germany uses licensed dual systems; no single PRO. Register LUCID / operator ZSVR.'
  WHERE id = 'EU-MS-DE-epr-registration' AND version = 1;
--> statement-breakpoint

-- 5. EU-MS-FR-epr-registration -------------------------------------------------
UPDATE checkpoints SET
  version = 2,
  citation = 'Code de l''environnement, Art. L.541-10-13 (with L.541-10 and L.541-10-1). https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043982447/',
  official_register = 'SYDEREP - ADEME producer register (unique identifier, IDU)',
  register_operator = 'ADEME',
  producer_responsibility_organisation = 'CITEO',
  source_corroborating = 'https://www.ademe.fr/',
  confidence = 'H',
  notes = 'Validated (docs/batch2-eu-validated.md). Register SYDEREP/ADEME (obtain an IDU); CITEO is the eco-organisme (PRO), not the register.'
  WHERE id = 'EU-MS-FR-epr-registration' AND version = 1;
--> statement-breakpoint

-- 6. EU-MS-ES-epr-registration -------------------------------------------------
UPDATE checkpoints SET
  version = 2,
  citation = 'Real Decreto 1055/2022, Titulo II, Cap. II, arts. 14-16 (art. 17 for the authorised representative). https://www.boe.es/eli/es/rd/2022/12/27/1055',
  official_register = 'Registro de Productores de Producto - seccion envases (RPP)',
  register_operator = 'MITECO',
  source_corroborating = 'https://www.miteco.gob.es/',
  confidence = 'H',
  notes = 'Validated (docs/batch2-eu-validated.md). RPP envases at MITECO; collective/individual EPR scheme, none named.'
  WHERE id = 'EU-MS-ES-epr-registration' AND version = 1;
--> statement-breakpoint

-- 7. EU-MS-IT-epr-registration -------------------------------------------------
UPDATE checkpoints SET
  version = 2,
  citation = 'D.Lgs. 152/2006, artt. 221, 223, 224 (CONAI or an authorised autonomous system); RENAP framework art. 178-ter and D.M. 144/2024. https://www.gazzettaufficiale.it/eli/id/2006/04/14/006G0171/sg',
  official_register = 'RENAP - Registro Nazionale dei Produttori (packaging framework)',
  register_operator = 'Ministero dell''Ambiente e della Sicurezza Energetica (RENAP)',
  producer_responsibility_organisation = 'CONAI',
  future_law_watch = 'packaging-specific RENAP endpoint status (D.M. 144/2024 implementation)',
  source_corroborating = 'https://www.renap.gov.it/',
  confidence = 'H',
  notes = 'Validated (docs/batch2-eu-validated.md). Compliance route via CONAI or an authorised autonomous system; RENAP is the register framework.'
  WHERE id = 'EU-MS-IT-epr-registration' AND version = 1;
--> statement-breakpoint

-- 8. EU-MS-NL-epr-registration -------------------------------------------------
UPDATE checkpoints SET
  version = 2,
  citation = 'Besluit beheer verpakkingen 2014, art. 8-9; Wet milieubeheer, art. 15.36. https://wetten.overheid.nl/BWBR0035711/',
  official_register = 'Verpact packaging declaration / register',
  register_operator = 'Stichting Verpact (formerly Afvalfonds Verpakkingen)',
  contribution_threshold = '50000 kg of packaging placed on the market per year (contribution/reporting threshold)',
  source_corroborating = 'https://www.verpact.nl/',
  confidence = 'H',
  notes = 'Validated (docs/batch2-eu-validated.md). Operator is Stichting Verpact (not Afvalfonds). 50,000 kg is the contribution/reporting threshold only; no separate registration threshold.'
  WHERE id = 'EU-MS-NL-epr-registration' AND version = 1;
--> statement-breakpoint

-- 9. EU-MS-PL-epr-registration -------------------------------------------------
UPDATE checkpoints SET
  version = 2,
  citation = 'Ustawa z 13.06.2013 o gospodarce opakowaniami i odpadami opakowaniowymi (Dz.U. 2026 poz. 619, tekst jednolity); Ustawa o odpadach, art. 49 (BDO). https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20130000888',
  official_register = 'BDO - Baza danych o produktach i opakowaniach',
  register_operator = 'Marszalek wojewodztwa (BDO)',
  future_law_watch = 'proposed PPWR/EPR reform - not enacted',
  source_corroborating = 'https://bdo.mos.gov.pl/',
  confidence = 'H',
  notes = 'Validated (docs/batch2-eu-validated.md). BDO register; obligations met via recovery organisations, none named.'
  WHERE id = 'EU-MS-PL-epr-registration' AND version = 1;
