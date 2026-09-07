-- Reconcile the nine Batch 2 EU rows against the ACTUAL validated report
-- (docs/ppwr-batch-2-validated.md). requirement_text is replaced VERBATIM with
-- the report's "Validated value" (markdown emphasis stripped); citations,
-- corroborating URLs, registers and exemptions corrected per the report's
-- "conflicts resolved". All nine texts now match the validated file, so all stay
-- confidence H. Rows advance draft v2 -> v3 (content changed); still draft.

-- 1. EU-PPWR-recyclability-grade ----------------------------------------------
UPDATE checkpoints SET
  version = 3,
  requirement_text = 'Recyclability grades by weight: A ≥95%; B ≥80%; C ≥70%; below 70% = technically non-recyclable. Subject to Article 6 exceptions, packaging must achieve A, B or C from 1 Jan 2030 or 24 months after the Article 6(4) delegated acts enter into force, whichever is later. From 1 Jan 2038, Grade C may no longer be placed on the market. The recycled-at-scale assessment applies from 1 Jan 2035 or five years after the Article 6(5) implementing acts enter into force, whichever is later.',
  later_of_condition = 'Design-for-recycling grade from 1 Jan 2030 or 24 months after the Article 6(4) delegated acts, whichever is later; recycled-at-scale from 1 Jan 2035 or five years after the Article 6(5) implementing acts, whichever is later. (The "36 months after implementing act" and three-year clauses do not apply to Article 6 recyclability.)',
  citation = 'Regulation (EU) 2025/40, Article 6(2)-(5), Annex II Table 3. https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  source_corroborating = 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32025R0040',
  confidence = 'H',
  notes = 'Validated verbatim (docs/ppwr-batch-2-validated.md). Grade C sunset 1 Jan 2038. FORWARD row — draft.'
  WHERE id = 'EU-PPWR-recyclability-grade' AND version = 2;
--> statement-breakpoint

-- 2. EU-PPWR-recycled-content-plastic -----------------------------------------
UPDATE checkpoints SET
  version = 3,
  requirement_text = 'Minimum post-consumer recycled content in plastic parts, per packaging type and format and averaged per manufacturing plant and year: from 1 Jan 2030 or three years after the Article 7(8) implementing act enters into force, whichever is later: 30% contact-sensitive PET; 10% contact-sensitive non-PET; 30% single-use plastic beverage bottles; 35% other plastic packaging. From 2040: 50% / 25% / 65% / 65% respectively.',
  later_of_condition = 'From 1 Jan 2030 or three years after the Article 7(8) implementing act enters into force, whichever is later.',
  exemptions = '[{"scope":"Specified immediate packaging of medicinal products for human and veterinary use","basis_pinpoint":"Regulation (EU) 2025/40, Art 7(4)"},{"scope":"Specified contact-sensitive packaging of medical devices","basis_pinpoint":"Art 7(4)"},{"scope":"Packaging of in-vitro diagnostic medical devices","basis_pinpoint":"Art 7(4)"},{"scope":"Necessary outer packaging of medicinal products","basis_pinpoint":"Art 7(4)"},{"scope":"Compostable plastic packaging","basis_pinpoint":"Art 7(4)"},{"scope":"Packaging for the transport of dangerous goods","basis_pinpoint":"Art 7(4)"},{"scope":"Specified packaging of foods for infants and young children and foods for special medical purposes","basis_pinpoint":"Art 7(4)"},{"scope":"Qualifying food-contact packaging where recycled content would threaten health or non-compliance","basis_pinpoint":"Art 7(5)"},{"scope":"Each plastic part representing less than 5% of the whole packaging unit''s weight","basis_pinpoint":"Art 7(5)"}]'::jsonb,
  citation = 'Regulation (EU) 2025/40, Article 7(1)-(5). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  source_corroborating = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52026XC03084',
  confidence = 'H',
  notes = 'Validated verbatim (docs/ppwr-batch-2-validated.md). Post-consumer, per manufacturing plant. Art 7(4) list item-by-item + Art 7(5). Do not shorten to "all medical/pharma packaging is exempt". FORWARD row — draft.'
  WHERE id = 'EU-PPWR-recycled-content-plastic' AND version = 2;
--> statement-breakpoint

-- 3. EU-green-claims-substantiation -------------------------------------------
UPDATE checkpoints SET
  version = 3,
  requirement_text = 'The amended UCPD blacklist prohibits: (i) displaying a sustainability label not based on a certification scheme or established by public authorities; (ii) making a generic environmental claim without demonstrated recognised excellent environmental performance relevant to the claim; and (iii) claiming an entire product or business benefit where only an aspect/activity supports it. Member States had to transpose by 27 Mar 2026 and must apply the measures from 27 Sep 2026.',
  citation = 'Directive (EU) 2024/825, Article 4 and Annex, points 2a (sustainability labels) and 4a-4b (generic and over-broad claims). https://eur-lex.europa.eu/eli/dir/2024/825/oj/eng',
  source_corroborating = 'https://commission.europa.eu/topics/consumers/consumer-rights-and-complaints/enforcement-consumer-protection/coordinated-actions/sustainable-consumption-actions_en',
  confidence = 'H',
  notes = 'Validated verbatim (docs/ppwr-batch-2-validated.md). Label rule is Annex I point 2a (corrected). Directive — enforcement via national transposition.'
  WHERE id = 'EU-green-claims-substantiation' AND version = 2;
--> statement-breakpoint

-- 4. EU-MS-DE-epr-registration ------------------------------------------------
UPDATE checkpoints SET
  version = 3,
  requirement_text = 'Verpackungsrecht-Durchführungsgesetz (VerpackDG): §6 registration; §7 system participation; §9 data reporting. Register: LUCID, operated by ZSVR. PPWR Article 44 is integrated into the German system.',
  citation = 'Verpackungsrecht-Durchführungsgesetz (VerpackDG): §6 (registration), §7 (system participation), §9 (data reporting). https://www.gesetze-im-internet.de/verpackdg/BJNR0CF0B0026.html',
  official_register = 'LUCID',
  register_operator = 'ZSVR (Zentrale Stelle Verpackungsregister)',
  source_corroborating = 'https://www.verpackungsregister.org/en/registration/find-out-about-registrations',
  confidence = 'H',
  notes = 'Validated verbatim (docs/ppwr-batch-2-validated.md). VerpackG was replaced by VerpackDG on 12 Aug 2026 — do not use the old VerpackG pinpoints. No single PRO (licensed dual systems).'
  WHERE id = 'EU-MS-DE-epr-registration' AND version = 2;
--> statement-breakpoint

-- 5. EU-MS-FR-epr-registration ------------------------------------------------
UPDATE checkpoints SET
  version = 3,
  requirement_text = 'Code de l''environnement L.541-10 and L.541-10-1 establish the EPR framework and covered streams; L.541-10-13 requires registration and the unique identifier. Current packaging rules include R.543-43 and, for household packaging waste, R.543-53–R.543-56. Register/declaration system: ADEME SYDEREP.',
  citation = 'Code de l''environnement, Art. L.541-10-13 (registration and unique identifier); L.541-10 and L.541-10-1 (EPR framework). https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041583847',
  official_register = 'ADEME SYDEREP (unique identifier, IDU)',
  register_operator = 'ADEME',
  producer_responsibility_organisation = 'CITEO',
  source_corroborating = 'https://filieres-rep.ademe.fr/identifiant-unique',
  confidence = 'H',
  notes = 'Validated verbatim (docs/ppwr-batch-2-validated.md). CITEO is an approved PRO, NOT the national register; ADEME/SYDEREP is the register authority.'
  WHERE id = 'EU-MS-FR-epr-registration' AND version = 2;
--> statement-breakpoint

-- 6. EU-MS-ES-epr-registration ------------------------------------------------
UPDATE checkpoints SET
  version = 3,
  requirement_text = 'Real Decreto 1055/2022, Title II, Chapter II, Articles 14–16: Article 14 creates the packaging section of the Product Producers Register; Article 15 requires registration; Article 16 requires annual reporting. Register: MITECO Registro de Productores de Producto (RPP), sección envases. PPWR Article 44 now affects the producer definition and reporting framework.',
  citation = 'Real Decreto 1055/2022, Título II, Cap. II, arts. 14-16 (art. 14 register section, art. 15 registration, art. 16 annual reporting). https://www.boe.es/eli/es/rd/2022/12/27/1055',
  official_register = 'Registro de Productores de Producto (RPP), sección envases',
  register_operator = 'MITECO',
  source_corroborating = 'https://www.miteco.gob.es/es/calidad-y-evaluacion-ambiental/temas/prevencion-y-gestion-residuos/registro-productores-producto/registro-productores-producto-seccion-envases.html',
  confidence = 'H',
  notes = 'Validated verbatim (docs/ppwr-batch-2-validated.md). Registration is Title II, Chapter II, arts. 14-16 (NOT Title III).'
  WHERE id = 'EU-MS-ES-epr-registration' AND version = 2;
--> statement-breakpoint

-- 7. EU-MS-IT-epr-registration ------------------------------------------------
UPDATE checkpoints SET
  version = 3,
  requirement_text = 'Current EPR duties/routes remain grounded in D.Lgs. 152/2006 Articles 221, 223 and 224: producers/users generally participate in CONAI, unless using a recognised autonomous system. The national EPR register framework is RENAP, established under D.Lgs. 152/2006 Article 178-ter and D.M. 15 April 2024 No. 144.',
  citation = 'D.Lgs. 152/2006, artt. 221, 223, 224 (CONAI or a recognised autonomous system); RENAP register framework — art. 178-ter and D.M. 15 April 2024 No. 144. https://www.gazzettaufficiale.it/anteprima/codici/materiaAmbientale',
  official_register = 'RENAP (Registro Nazionale dei Produttori) — national register framework',
  register_operator = 'Ministero dell''Ambiente e della Sicurezza Energetica (RENAP)',
  producer_responsibility_organisation = 'CONAI',
  future_law_watch = 'A fully operational packaging-specific RENAP registration endpoint was not evidenced in current materials (art. 178-ter + D.M. 144/2024 implementation).',
  source_corroborating = 'https://www.renap.gov.it/it/scopri-di-piu-su-renap',
  confidence = 'H',
  notes = 'Validated verbatim (docs/ppwr-batch-2-validated.md). CONAI is the EPR compliance route, NOT the PPWR national-register number; RENAP is the register framework.'
  WHERE id = 'EU-MS-IT-epr-registration' AND version = 2;
--> statement-breakpoint

-- 8. EU-MS-NL-epr-registration ------------------------------------------------
UPDATE checkpoints SET
  version = 3,
  requirement_text = 'Core legal basis: Besluit beheer verpakkingen 2014, particularly Article 8 reporting and Article 9 collective implementation, together with Wet milieubeheer Article 15.36 and the generally binding Packaging Waste Management Contribution Agreement 2023–2027. Current operating organisation/portal: Stichting Verpact / Mijn Verpact.',
  citation = 'Besluit beheer verpakkingen 2014, art. 8 (reporting) and art. 9 (collective implementation); Wet milieubeheer, art. 15.36. https://wetten.overheid.nl/BWBR0035711/2024-01-01',
  official_register = 'Verpact packaging declaration / register (Mijn Verpact)',
  register_operator = 'Stichting Verpact',
  contribution_threshold = 'Legacy 50,000 kg contribution/reporting threshold — NOT a PPWR Article 44 registration exemption',
  source_corroborating = 'https://www.verpact.nl/nl/administratie',
  confidence = 'H',
  notes = 'Validated verbatim (docs/ppwr-batch-2-validated.md). "Afvalfonds Verpakkingen" became Stichting Verpact in 2024. PPWR Art 44 has no blanket 50-tonne exemption; registration_threshold null.'
  WHERE id = 'EU-MS-NL-epr-registration' AND version = 2;
--> statement-breakpoint

-- 9. EU-MS-PL-epr-registration ------------------------------------------------
UPDATE checkpoints SET
  version = 3,
  requirement_text = 'Current basis: Act of 13 June 2013 on packaging and packaging-waste management plus Waste Act of 14 December 2012, Article 49, which covers the register of entities placing products and products in packaging on the market. Register: BDO.',
  citation = 'Ustawa z 13.06.2013 o gospodarce opakowaniami i odpadami opakowaniowymi; Ustawa o odpadach z 14.12.2012, art. 49 (BDO register). Dz.U. 2026 poz. 619 (consolidated). https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20260000619',
  official_register = 'BDO (Baza danych o produktach i opakowaniach)',
  register_operator = 'BDO (Marszałek województwa)',
  future_law_watch = 'Proposed Polish PPWR/EPR implementation reform — remains proposed in the EUNR listing; track separately, not yet enacted.',
  source_corroborating = 'https://bdo.mos.gov.pl/',
  confidence = 'H',
  notes = 'Validated verbatim (docs/ppwr-batch-2-validated.md). Use the current 2026 consolidated text (Dz.U. 2026 poz. 619).'
  WHERE id = 'EU-MS-PL-epr-registration' AND version = 2;
