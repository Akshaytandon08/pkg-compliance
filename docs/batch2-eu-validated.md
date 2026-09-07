# Batch 2 EU — validation report (product owner)

Validated encodings for the nine Batch 2 EU checkpoints. Ingested by migration
`0023` as **draft v2** (all rows stay draft; approval remains human-only). Every
row is confidence **H** and carries a corroborating source distinct from its
primary citation.

> Provenance note: the structured facts below (thresholds, legal bases,
> registers, operators, PROs, exemption references, phase-in clauses, citations)
> are the product owner's validated findings. The `requirement_text` prose is the
> recommended wording composed to match each cited article; confirm verbatim
> against primary at approval.

Domain policy: national **legislative** sources are the primary `citation`
(gesetze-im-internet.de, legifrance.gouv.fr, boe.es, gazzettaufficiale.it,
wetten.overheid.nl, officielebekendmakingen.nl, isap.sejm.gov.pl, eur-lex).
Official **register** domains (verpackungsregister.org, ademe.fr, miteco.gob.es,
renap.gov.it, verpact.nl, bdo.mos.gov.pl) are `source_corroborating` ONLY —
never the primary citation.

---

## EU-PPWR-recyclability-grade (component)

- **requirement_text:** "From the applicable date, packaging must be designed for recycling and assigned a recyclability performance grade by weight: Grade A (at least 95% of the unit recyclable), Grade B (at least 80%), or Grade C (at least 70%), under the design-for-recycling criteria set by delegated act. Packaging that does not reach Grade C (below 70% recyclable by weight) may not be placed on the market."
- **thresholds:** Grade A ≥ 95, Grade B ≥ 80, Grade C ≥ 70 (% recyclable by weight).
- **later_of_condition:** 24 months after the Article 6(4) delegated acts (design-for-recycling criteria), or 5 years after the Article 6(5) implementing acts (recycled-at-scale assessment), whichever is later.
- **citation:** Regulation (EU) 2025/40, Article 6(2)–(5) and Annex II, Table 3. https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng
- **source_corroborating:** https://environment.ec.europa.eu/topics/waste-and-recycling/packaging-waste_en
- **confidence:** H

## EU-PPWR-recycled-content-plastic (component)

- **requirement_text:** "From the applicable date, plastic packaging must contain a minimum share of post-consumer recycled plastic content, calculated as an average per manufacturing plant and per year, differentiated by packaging category and contact sensitivity."
- **thresholds (category · from-year · minimum %):**
  - Contact-sensitive plastic packaging, made from PET — 2030: 30 · 2040: 50
  - Contact-sensitive plastic packaging, other than PET — 2030: 10 · 2040: 25
  - Single-use plastic beverage bottles — 2030: 30 · 2040: 65
  - Other plastic packaging — 2030: 35 · 2040: 65
- **later_of_condition:** 3 years after the Article 7(8) implementing act (calculation and verification methodology).
- **exemptions (Art 7(4) list item-by-item + Art 7(5)):**
  - Compostable plastic packaging — Art 7(4)
  - Immediate packaging of medicinal products (human/veterinary) — Art 7(4)
  - Immediate packaging of medical devices and in-vitro diagnostics — Art 7(4)
  - Contact-sensitive packaging of foods for infants/young children and foods for special medical purposes — Art 7(4)
  - Packaging for the transport of dangerous goods — Art 7(4)
  - Recycled content that would conflict with food-contact or health-and-safety requirements — Art 7(5)
  - Plastic parts each representing less than 5% of the total weight of the packaging unit — Art 7(5)
- **scope wording:** "post-consumer plastic waste"; calculated per "manufacturing plant".
- **citation:** Regulation (EU) 2025/40, Article 7(1)–(5) and (8). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng
- **source_corroborating:** https://environment.ec.europa.eu/topics/waste-and-recycling/packaging-waste_en
- **confidence:** H

## EU-green-claims-substantiation (packaging_unit)

- **requirement_text:** "Environmental claims and sustainability labels made on or about the packaging must be substantiated on recognised and relevant evidence. Generic environmental claims made without recognised excellent environmental performance relevant to the claim are prohibited, and sustainability labels must be based on a certification scheme or established by a public authority."
- **citation:** Directive (EU) 2024/825, Article 4; new UCPD (Directive 2005/29/EC) Annex I points 2(a), 4(a) and 4(b). https://eur-lex.europa.eu/eli/dir/2024/825/oj
- **trigger_date:** 2026-09-27
- **jurisdiction note (→ notes):** enforcement is via national transposition; Member States apply the measures from 27 September 2026.
- **source_corroborating:** https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-protection-cooperation-network/empowering-consumers-green-transition_en
- **confidence:** H

## EU-MS-DE-epr-registration (organisation)

- **legal basis / citation:** Verpackungsgesetz (VerpackG) §§ 6, 7, 9. https://www.gesetze-im-internet.de/verpackg/
- **official_register:** LUCID (Verpackungsregister)
- **register_operator:** Zentrale Stelle Verpackungsregister (ZSVR)
- **producer_responsibility_organisation:** — (Germany uses licensed dual systems; no single PRO)
- **source_corroborating:** https://www.verpackungsregister.org/
- **confidence:** H

## EU-MS-FR-epr-registration (organisation)

- **legal basis / citation:** Code de l'environnement, Art. L.541-10-13 (with L.541-10 and L.541-10-1). https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043982447/
- **official_register:** SYDEREP — ADEME producer register (unique identifier, IDU)
- **register_operator:** ADEME
- **producer_responsibility_organisation:** CITEO (éco-organisme — PRO only, not the register)
- **source_corroborating:** https://www.ademe.fr/
- **confidence:** H

## EU-MS-ES-epr-registration (organisation)

- **legal basis / citation:** Real Decreto 1055/2022, Título II, Cap. II, arts. 14–16 (art. 17 for the authorised representative). https://www.boe.es/eli/es/rd/2022/12/27/1055
- **official_register:** Registro de Productores de Producto — sección envases (RPP)
- **register_operator:** MITECO
- **producer_responsibility_organisation:** — (collective/individual scheme; none named)
- **source_corroborating:** https://www.miteco.gob.es/
- **confidence:** H

## EU-MS-IT-epr-registration (organisation)

- **legal basis / citation:** D.Lgs. 152/2006, artt. 221, 223, 224 (participation in CONAI or an authorised autonomous system); RENAP framework — art. 178-ter and D.M. 144/2024. https://www.gazzettaufficiale.it/eli/id/2006/04/14/006G0171/sg
- **official_register:** RENAP — Registro Nazionale dei Produttori (packaging framework)
- **register_operator:** Ministero dell'Ambiente e della Sicurezza Energetica (RENAP)
- **producer_responsibility_organisation:** CONAI (or an authorised autonomous system)
- **future_law_watch:** packaging-specific RENAP endpoint status (D.M. 144/2024 implementation)
- **source_corroborating:** https://www.renap.gov.it/
- **confidence:** H

## EU-MS-NL-epr-registration (organisation)

- **legal basis / citation:** Besluit beheer verpakkingen 2014, art. 8–9; Wet milieubeheer, art. 15.36. https://wetten.overheid.nl/BWBR0035711/
- **official_register:** Verpact packaging declaration / register
- **register_operator:** Stichting Verpact (formerly Afvalfonds Verpakkingen)
- **producer_responsibility_organisation:** — (collective scheme; none separately named)
- **contribution_threshold:** 50000 kg of packaging placed on the market per year — recorded ONLY as the contribution/reporting threshold
- **registration_threshold:** null (no separate registration threshold)
- **source_corroborating:** https://www.verpact.nl/
- **confidence:** H

## EU-MS-PL-epr-registration (organisation)

- **legal basis / citation:** Ustawa z 13.06.2013 o gospodarce opakowaniami i odpadami opakowaniowymi (Dz.U. 2026 poz. 619, tekst jednolity); Ustawa o odpadach, art. 49 (BDO). https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20130000888
- **official_register:** BDO — Baza danych o produktach i opakowaniach
- **register_operator:** Marszałek województwa (BDO)
- **producer_responsibility_organisation:** — (obligations met via recovery organisations; none named)
- **future_law_watch:** proposed PPWR/EPR reform — not enacted
- **source_corroborating:** https://bdo.mos.gov.pl/
- **confidence:** H
