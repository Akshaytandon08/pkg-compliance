-- Ingest the seven validated India PWM rows (docs/india-pwm-validated.md).
-- requirement_text is the report's "Validated value" VERBATIM; citations use the
-- report's "Exact legal pinpoint" + primary Gazette URLs; source_corroborating
-- from the report's official-sources list. All rows draft v1 (never approved) ->
-- draft v2; approval stays human-only. Consolidated through G.S.R. 237(E),
-- 31 Mar 2026 (heading note); G.S.R. 237(E) is NOT the anchor for every row.

-- 1. IN-PWM-epr-registration ---------------------------------------------------
UPDATE checkpoints SET
  version = 2,
  requirement_text = 'Producers, importers and brand owners in scope must register through the CPCB-developed centralised online portal. The registered classes also include plastic-waste processors; after the 2024 amendment, Schedule II paragraph 6.1 additionally covers manufacturers/importers of plastic raw material and manufacturers of items made from compostable or biodegradable plastics. Covered entities may not carry on business without registration or deal with an entity required to register but not registered.',
  citation = 'Plastic Waste Management Rules, 2016 (consolidated through G.S.R. 237(E), 31 Mar 2026), Rule 9(1); Schedule II paragraphs 6.1-6.5 and 10.1 (Schedule II inserted by G.S.R. 133(E); paras 6.1 and 10.1 substituted by G.S.R. 201(E), rule 12(iv),(vii)(b)). https://www.eprplastic.cpcb.gov.in/plastic/downloads/Plastic_Waste_Management_Amendment_Rules_2024.pdf',
  source_corroborating = 'https://moef.gov.in/uploads/pdf-uploads/pdf_68401a627be674.03844470.pdf',
  confidence = 'H',
  notes = 'Validated verbatim (docs/india-pwm-validated.md). Registration pinpoint is Schedule II para 6, NOT G.S.R. 237(E).'
  WHERE id = 'IN-PWM-epr-registration' AND version = 1;
--> statement-breakpoint

-- 2. IN-PWM-category-classification -------------------------------------------
UPDATE checkpoints SET
  version = 2,
  requirement_text = 'I: rigid plastic packaging. II: flexible single-layer or plastic-only multilayer packaging, plastic sheets/covers, carry bags, sachets and pouches. III: multilayered packaging containing at least one plastic layer and at least one non-plastic-material layer. IV: plastic sheets or like used for packaging, and carry bags and commodities made of compostable plastics. V: plastic sheets or like used for packaging, and carry bags and commodities made of biodegradable plastics.',
  citation = 'Plastic Waste Management Rules, 2016 (consolidated through G.S.R. 237(E), 31 Mar 2026), Schedule II paragraph 5.1(i)-(v) (Categories I-IV from G.S.R. 133(E); Cat IV expanded and Cat V inserted by G.S.R. 201(E), rule 12(iii)). https://www.eprplastic.cpcb.gov.in/plastic/downloads/Plastic_Waste_Management_Amendment_Rules_2024.pdf',
  source_corroborating = 'https://moef.gov.in/uploads/pdf-uploads/pdf_68401a627be674.03844470.pdf',
  confidence = 'H',
  notes = 'Validated verbatim (docs/india-pwm-validated.md). FIVE categories (Cat V biodegradable added Mar 2024); Cat IV includes commodities. Do not merge IV and V.'
  WHERE id = 'IN-PWM-category-classification' AND version = 1;
--> statement-breakpoint

-- 3. IN-PWM-epr-recycled-content ----------------------------------------------
UPDATE checkpoints SET
  version = 2,
  requirement_text = 'Mandatory recycled plastic as a percentage of plastic packaging manufactured/imported for the year: Cat I: 30%, 40%, 50%, 60%; Cat II: 10%, 10%, 20%, 20%; Cat III: 5%, 5%, 10%, 10% for FY 2025-26, 2026-27, 2027-28, and 2028-29 onward, respectively. For Category III, the target is limited to the total weight of the plastic layers. A statutory prohibition on recycled content can disapply the target, but the applicable law/rule/regulation/mandatory Indian Standard must be identified in the annual return. The unfulfilled FY 2025-26 food-contact target may be carried forward for up to three consecutive years from FY 2026-27, with at least one third of the carried-forward shortfall completed in each year. For an importer, recycled plastic already present in imported material does not count toward fulfilment; the importer must meet the quantitative obligation through eligible excess-use certificates under the portal mechanism.',
  thresholds = '[{"parameter":"recycled content Cat I","operator":">=","value":30,"unit":"% by weight","applies_when":"FY 2025-26"},{"parameter":"recycled content Cat I","operator":">=","value":40,"unit":"% by weight","applies_when":"FY 2026-27"},{"parameter":"recycled content Cat I","operator":">=","value":50,"unit":"% by weight","applies_when":"FY 2027-28"},{"parameter":"recycled content Cat I","operator":">=","value":60,"unit":"% by weight","applies_when":"FY 2028-29 onward"},{"parameter":"recycled content Cat II","operator":">=","value":10,"unit":"% by weight","applies_when":"FY 2025-26"},{"parameter":"recycled content Cat II","operator":">=","value":10,"unit":"% by weight","applies_when":"FY 2026-27"},{"parameter":"recycled content Cat II","operator":">=","value":20,"unit":"% by weight","applies_when":"FY 2027-28"},{"parameter":"recycled content Cat II","operator":">=","value":20,"unit":"% by weight","applies_when":"FY 2028-29 onward"},{"parameter":"recycled content Cat III (plastic layers)","operator":">=","value":5,"unit":"% by weight","applies_when":"FY 2025-26"},{"parameter":"recycled content Cat III (plastic layers)","operator":">=","value":5,"unit":"% by weight","applies_when":"FY 2026-27"},{"parameter":"recycled content Cat III (plastic layers)","operator":">=","value":10,"unit":"% by weight","applies_when":"FY 2027-28"},{"parameter":"recycled content Cat III (plastic layers)","operator":">=","value":10,"unit":"% by weight","applies_when":"FY 2028-29 onward"}]'::jsonb,
  exemptions = '[{"scope":"A statutory prohibition on recycled content disapplies the target; the applicable law/rule/regulation/mandatory Indian Standard must be identified in the annual return","basis_pinpoint":"Schedule II paras 7.2(d), 7.3(d), 7.4(e)"}]'::jsonb,
  citation = 'Plastic Waste Management Rules, 2016 (consolidated through G.S.R. 237(E), 31 Mar 2026), Schedule II paragraphs 7.2(d), 7.3(d), 7.4(e), substituted by G.S.R. 237(E), rule 7(a)-(c). https://egazette.gov.in/WriteReadData/2026/271465.pdf',
  source_corroborating = 'https://www.eprplastic.cpcb.gov.in/',
  confidence = 'H',
  notes = 'Validated verbatim (docs/india-pwm-validated.md). Cat I FY 2026-27 is 40% (not 30/60); 60% from FY 2028-29. Importer: pre-incorporated recycled content is not credited — meet via excess-use certificates.'
  WHERE id = 'IN-PWM-epr-recycled-content' AND version = 1;
--> statement-breakpoint

-- 4. IN-PWM-epr-targets -------------------------------------------------------
UPDATE checkpoints SET
  version = 2,
  requirement_text = 'The EPR target—more accurately stated than "collection target"—is 25% in FY 2021-22, 70% in FY 2022-23 and 100% from FY 2023-24, calculated category-wise as a percentage of the applicable eligible quantity Q1/Q2/Q3. Minimum recycling, excluding end-of-life disposal, is a percentage of the EPR target: Cat I 50/60/70/80%; Cat II 30/40/50/60%; Cat III 30/40/50/60%; Cat IV 50/60/70/80% for FY 2024-25, 2025-26, 2026-27, and 2027-28 onward. For Category IV, "recycling" means processing through industrial composting facilities.',
  thresholds = '[{"parameter":"EPR target (of eligible quantity)","operator":">=","value":25,"unit":"%","applies_when":"FY 2021-22"},{"parameter":"EPR target (of eligible quantity)","operator":">=","value":70,"unit":"%","applies_when":"FY 2022-23"},{"parameter":"EPR target (of eligible quantity)","operator":">=","value":100,"unit":"%","applies_when":"FY 2023-24 onward"},{"parameter":"minimum recycling Cat I (of EPR target)","operator":">=","value":50,"unit":"%","applies_when":"FY 2024-25"},{"parameter":"minimum recycling Cat I (of EPR target)","operator":">=","value":60,"unit":"%","applies_when":"FY 2025-26"},{"parameter":"minimum recycling Cat I (of EPR target)","operator":">=","value":70,"unit":"%","applies_when":"FY 2026-27"},{"parameter":"minimum recycling Cat I (of EPR target)","operator":">=","value":80,"unit":"%","applies_when":"FY 2027-28 onward"},{"parameter":"minimum recycling Cat II (of EPR target)","operator":">=","value":30,"unit":"%","applies_when":"FY 2024-25"},{"parameter":"minimum recycling Cat II (of EPR target)","operator":">=","value":40,"unit":"%","applies_when":"FY 2025-26"},{"parameter":"minimum recycling Cat II (of EPR target)","operator":">=","value":50,"unit":"%","applies_when":"FY 2026-27"},{"parameter":"minimum recycling Cat II (of EPR target)","operator":">=","value":60,"unit":"%","applies_when":"FY 2027-28 onward"},{"parameter":"minimum recycling Cat III (of EPR target)","operator":">=","value":30,"unit":"%","applies_when":"FY 2024-25"},{"parameter":"minimum recycling Cat III (of EPR target)","operator":">=","value":40,"unit":"%","applies_when":"FY 2025-26"},{"parameter":"minimum recycling Cat III (of EPR target)","operator":">=","value":50,"unit":"%","applies_when":"FY 2026-27"},{"parameter":"minimum recycling Cat III (of EPR target)","operator":">=","value":60,"unit":"%","applies_when":"FY 2027-28 onward"},{"parameter":"minimum recycling Cat IV — industrial composting (of EPR target)","operator":">=","value":50,"unit":"%","applies_when":"FY 2024-25"},{"parameter":"minimum recycling Cat IV — industrial composting (of EPR target)","operator":">=","value":60,"unit":"%","applies_when":"FY 2025-26"},{"parameter":"minimum recycling Cat IV — industrial composting (of EPR target)","operator":">=","value":70,"unit":"%","applies_when":"FY 2026-27"},{"parameter":"minimum recycling Cat IV — industrial composting (of EPR target)","operator":">=","value":80,"unit":"%","applies_when":"FY 2027-28 onward"}]'::jsonb,
  citation = 'Plastic Waste Management Rules, 2016 (consolidated through G.S.R. 237(E), 31 Mar 2026), Schedule II paragraphs 7.1; 7.2(a)-(b); 7.3(a)-(b); 7.4(a),(c) (G.S.R. 133(E)). https://moef.gov.in/uploads/pdf-uploads/pdf_68401a627be674.03844470.pdf',
  source_corroborating = 'https://cpcb.nic.in/uploads/plasticwaste/EC_Regime_PWM_04-04-2024.pdf',
  confidence = 'H',
  notes = 'Validated verbatim (docs/india-pwm-validated.md). EPR target reaches 100% in FY 2023-24 (not FY 2024-25). Two distinct controls: EPR target (on eligible quantity) and minimum recycling (on the EPR target).'
  WHERE id = 'IN-PWM-epr-targets' AND version = 1;
--> statement-breakpoint

-- 5. IN-PWM-thickness ---------------------------------------------------------
UPDATE checkpoints SET
  version = 2,
  requirement_text = 'Carry bags made of virgin or recycled plastic: minimum 75 μm from 30 September 2021, increased to 120 μm from 31 December 2022. Plastic sheet or like material that is not an integral part of multilayered packaging, and covers made from such sheet for packaging/wrapping a commodity: minimum 50 μm, subject to the Rule 4(1)(d) functionality exception specified by the Central Government. Also relevant but absent from the proposed value: non-woven plastic carry bags must be at least 60 GSM from 30 September 2021.',
  thresholds = '[{"parameter":"carry bag thickness (virgin or recycled plastic)","operator":">=","value":75,"unit":"μm","applies_when":"from 30 Sep 2021"},{"parameter":"carry bag thickness (virgin or recycled plastic)","operator":">=","value":120,"unit":"μm","applies_when":"from 31 Dec 2022"},{"parameter":"non-integral plastic sheet/cover thickness","operator":">=","value":50,"unit":"μm","applies_when":"subject to Rule 4(1)(d) functionality exception"},{"parameter":"non-woven plastic carry bag areal weight","operator":">=","value":60,"unit":"GSM","applies_when":"from 30 Sep 2021"}]'::jsonb,
  exemptions = '[{"scope":"Plastic sheet/cover functionality exception as specified by the Central Government (50 μm requirement)","basis_pinpoint":"Rule 4(1)(d)"}]'::jsonb,
  citation = 'Plastic Waste Management Rules, 2016 (consolidated through G.S.R. 237(E), 31 Mar 2026), Rule 4(1)(c),(d),(j); G.S.R. 571(E), rule 4(a)(ii),(v). https://static.pib.gov.in/WriteReadData/specificdocs/documents/2021/aug/doc202181311.pdf',
  source_corroborating = 'https://cpcb.nic.in/uploads/plasticwaste/EC_Regime_PWM_04-04-2024.pdf',
  confidence = 'H',
  notes = 'Validated verbatim (docs/india-pwm-validated.md). G.S.R. 571(E) created the 75/120 μm carry-bag schedule (not G.S.R. 522(E)). Non-woven carry bags ≥60 GSM.'
  WHERE id = 'IN-PWM-thickness' AND version = 1;
--> statement-breakpoint

-- 6. IN-PWM-sup-ban -----------------------------------------------------------
UPDATE checkpoints SET
  version = 2,
  requirement_text = 'From 1 July 2022, manufacture, import, stocking, distribution, sale and use are prohibited for the listed single-use plastic commodities, including polystyrene and expanded polystyrene: (a) ear buds with plastic sticks; plastic sticks for balloons; plastic flags; candy sticks; ice-cream sticks; polystyrene (Thermocol) for decoration; (b) plates, cups, glasses, cutlery such as forks, spoons and knives, straw, trays, wrapping or packing films around sweet boxes, invitation cards and cigarette packets, plastic or PVC banners below 100 μm, and stirrers.',
  thresholds = '[{"parameter":"plastic or PVC banner thickness (below this is a prohibited SUP item)","operator":">=","value":100,"unit":"μm"}]'::jsonb,
  citation = 'Plastic Waste Management Rules, 2016 (consolidated through G.S.R. 237(E), 31 Mar 2026), Rule 4(2)(a)-(b), inserted by G.S.R. 571(E), rule 4(b). https://static.pib.gov.in/WriteReadData/specificdocs/documents/2021/aug/doc202181311.pdf',
  source_corroborating = 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1942104&lang=2&reg=48',
  confidence = 'H',
  notes = 'Validated verbatim (docs/india-pwm-validated.md). Closed statutory list (no "etc."); six prohibited activities. Banner entry uses a below-100-μm threshold.'
  WHERE id = 'IN-PWM-sup-ban' AND version = 1;
--> statement-breakpoint

-- 7. IN-PWM-marking -----------------------------------------------------------
UPDATE checkpoints SET
  version = 2,
  requirement_text = 'Baseline Rule 11(1) information includes the name and registration number of the producer or brand owner and thickness in the case of a carry bag and plastic packaging, subject to stated exceptions; imported carry bags, multilayered packaging and plastic packaging are brought within the marking clauses by Rule 11(1)(d). From 1 July 2025, the producer/importer/brand owner may provide the Rule 11(1) information by one of: (a) barcode or QR code on the package; (b) product-information brochure; or (c) a qualifying unique number printed on the package. The entity must notify CPCB of the route used. Separately, each recycled-plastic package or commodity must conform to IS 14534:2023, bear the prescribed recycled-content label/marking, and comply with applicable FSSAI marking/labelling for food-contact applications.',
  citation = 'Plastic Waste Management Rules, 2016 (consolidated through G.S.R. 237(E), 31 Mar 2026), Rule 11(1), 11(1A), 11(2) (Rule 11(1) amended by G.S.R. 522(E) rule 6; Rule 11(1A) inserted by G.S.R. 73(E), 23 Jan 2025, rule 2(i); Rule 11(2) substituted by G.S.R. 237(E), rule 3). https://eprplastic.cpcb.gov.in/plastic/downloads/PWMRules_23_01_2025.pdf',
  source_corroborating = 'https://egazette.gov.in/WriteReadData/2026/271465.pdf',
  confidence = 'H',
  notes = 'Validated verbatim (docs/india-pwm-validated.md). QR/barcode is only ONE of three Rule 11(1A) routes (not mandatory on all packaging); recycled-content disclosure is separate under Rule 11(2)/IS 14534:2023. No universal QR payload.'
  WHERE id = 'IN-PWM-marking' AND version = 1;
