CREATE TABLE "evidence_guidance" (
	"checkpoint_id" text NOT NULL,
	"checkpoint_version" integer NOT NULL,
	"evidence_type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"issuer_guidance" text,
	"must_contain" jsonb,
	"red_flags" jsonb,
	"typical_source_org_role" text,
	"cost_turnaround_note" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"corpus_version" text,
	"notes" text,
	CONSTRAINT "evidence_guidance_checkpoint_id_checkpoint_version_evidence_type_pk" PRIMARY KEY("checkpoint_id","checkpoint_version","evidence_type")
);
--> statement-breakpoint
ALTER TABLE "evidence_guidance" ADD CONSTRAINT "evidence_guidance_checkpoint_fk" FOREIGN KEY ("checkpoint_id","checkpoint_version") REFERENCES "public"."checkpoints"("id","version") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

-- Six DRAFT guidance rows for the demo pack's evidence situations. Content is
-- DERIVED from the corresponding checkpoint records (thresholds, reference
-- methods, requirement text, notes) — not new research. Stays draft; a human
-- promotes via corpus:approve (guidance mode). Nothing self-approves.

INSERT INTO evidence_guidance
  (checkpoint_id, checkpoint_version, evidence_type, issuer_guidance, must_contain, red_flags, typical_source_org_role, cost_turnaround_note, notes)
VALUES
(
  'EU-PPWR-heavy-metals', 1, 'supplier_declaration',
  'Request from the supplier of the component material (mill, resin/masterbatch maker, fastener supplier) a signed declaration on letterhead, naming the component/material it covers.',
  '["Names all four regulated metals: lead (Pb), cadmium (Cd), mercury (Hg), hexavalent chromium (Cr(VI))","States their summed concentration does not exceed 100 mg/kg in the component","Identifies the exact component/material covered","References the test basis or CR 13695-1:2000 where measured","Supplier name, signatory and date"]'::jsonb,
  '["Covers a different component or material than the BOM line","States only one metal rather than the summed four","No numeric limit, or a limit above 100 mg/kg","Undated or unsigned"]'::jsonb,
  'Component material supplier (paper mill, resin/masterbatch producer, fastener supplier)',
  'Usually free from the supplier; days to a few weeks. A routine declaration, not a lab test.',
  'Derived from EU-PPWR-heavy-metals@1 (threshold 100 mg/kg sum; method CR 13695-1:2000). Draft.'
),
(
  'EU-PPWR-heavy-metals', 1, 'lab_test',
  'Commission an accredited laboratory (NABL in India / ILAC-recognised) to test the component — XRF screening confirmed by the CR 13695-1:2000 reference method. Use where no supplier declaration exists or the component carries genuine chemistry risk (e.g. coloured pigments).',
  '["Measured concentrations of Pb, Cd, Hg and Cr(VI) and their sum","The 100 mg/kg limit with an explicit pass/fail","Method reference (CR 13695-1:2000 or equivalent)","The exact component/material and sample identity","Lab name, accreditation number and report date"]'::jsonb,
  '["Laboratory not accredited (no NABL/ILAC reference)","Scope covers a different component/material","Screening only, with no confirmatory method on a borderline result","Expired or undated report"]'::jsonb,
  'Accredited testing laboratory (NABL / ILAC)',
  'Paid test; typically 1-3 weeks and a per-sample fee. The recommended closing evidence where pigment or coating chemistry is a genuine risk.',
  'Derived from EU-PPWR-heavy-metals@1 (method CR 13695-1:2000). Draft.'
),
(
  'EU-PPWR-soc-minimisation', 1, 'supplier_declaration',
  'Request a substances-of-concern (SoC) minimisation statement from each supplier of inks, adhesives, coatings and functional additives (e.g. VCI), assessed per EN 13428:2004 Annex C.',
  '["Confirms substances of concern have been minimised","Covers the inks, adhesives, coatings and added functional substances actually used","References EN 13428:2004 Annex C (hazardous-substance minimisation)","Identifies the component/material covered","Supplier name, signatory and date"]'::jsonb,
  '["Silent on the inks/adhesives/coatings actually present","References the general source-reduction body of EN 13428 rather than Annex C","Generic wording not tied to the component"]'::jsonb,
  'Ink / adhesive / coating / additive supplier',
  'Usually free from the supplier; days to weeks. A statement, not a test.',
  'Derived from EU-PPWR-soc-minimisation@1 (EN 13428:2004 Annex C). Draft.'
),
(
  'INTL-ISPM15-heat-treatment', 1, 'marking',
  'The IPPC (HT) mark is applied by the accredited wood-treatment provider onto the wood packaging itself. Photograph the mark on each lot and keep the provider''s heat-treatment certificate as backup.',
  '["The IPPC symbol (ear-of-wheat)","ISO country code and the registered producer/treatment-provider code","The treatment code HT (heat treatment)","Legible on the solid-wood component (pallet/crate/dunnage)"]'::jsonb,
  '["A DB (methyl bromide) code instead of HT for an EU destination","A mark on plywood/OSB, which is exempt (may signal confusion)","Illegible or absent stamp on solid-wood packaging","Producer code not traceable to an accredited provider"]'::jsonb,
  'Accredited wood heat-treatment provider',
  'Applied at treatment (part of the pallet cost); verification is a photograph. Keep the provider''s HT certificate.',
  'Derived from INTL-ISPM15-heat-treatment@1 (HT 56C/30min; IPPC mark + treatment code). Draft.'
),
(
  'EU-PPWR-declaration-of-conformity', 1, 'conformity_declaration',
  'The obligated economic operator (the brand/spec owner) draws up and signs ONE EU declaration of conformity per packaging unit, in the language(s) of each Member State supplied. It is the operator''s own document; the screening only checks it is assembled. Retain 5 years single-use / 10 years reusable.',
  '["A unique identification of the packaging unit/spec (not one per component)","Name and address of the manufacturer / obligated operator","An explicit reference to Regulation (EU) 2025/40","Confirmation the packaging meets the applicable requirements (Articles 5-12)","A reference to the Annex VII technical documentation","Place and date of issue, name and signature of the signatory","Drawn up in the language(s) of each Member State where supplied"]'::jsonb,
  '["One declaration per component instead of per packaging unit","Missing the reference to the technical documentation","Not in the destination Member State language","Signed by a party who is not the obligated operator"]'::jsonb,
  'The obligated economic operator (brand/spec owner) — drawn up in-house, never by this system',
  'Drawn up by the operator once the technical file is assembled; no external cost.',
  'Derived from EU-PPWR-declaration-of-conformity@1 (Annex VIII; one per unit; MS language; retention 5/10y). Draft.'
),
(
  'EU-PPWR-technical-documentation', 1, 'technical_file',
  'The manufacturer compiles and HOLDS the Annex VII technical file (Module A, internal production control) for every packaging specification. Supplier retention alone is insufficient — the manufacturer must hold it.',
  '["A general description of the packaging and its intended use","Material specifications for every component/layer","Component-level construction drawings or photographs","Weights and composition","The supplier declarations and any test reports gathered","The recyclability / minimisation assessments where applicable"]'::jsonb,
  '["Held only by the supplier, not the manufacturer","Missing component-level material specs or drawings","No linkage to the declarations and test reports it should compile"]'::jsonb,
  'The manufacturer (compiled in-house from supplier inputs)',
  'Compiled in-house from the evidence gathered above; effort rather than external cost. Prerequisite to the declaration of conformity.',
  'Derived from EU-PPWR-technical-documentation@1 (Annex VII, Module A; manufacturer holds). Draft.'
);
