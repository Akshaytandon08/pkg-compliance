CREATE TABLE "doc_templates" (
	"template_id" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"source_citation" text NOT NULL,
	"source_url" text NOT NULL,
	"elements" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"corpus_version" text,
	"verified_at" timestamp with time zone,
	"verified_by" text,
	"notes" text,
	CONSTRAINT "doc_templates_template_id_version_pk" PRIMARY KEY("template_id","version")
);

--> statement-breakpoint
-- Seed the PPWR Annex VIII (EU declaration of conformity) structure as a DRAFT
-- doc_template. The elements are the VERBATIM Annex text; each flags whether the
-- manufacturer completes a field there. Status stays 'draft' — promotion to
-- 'approved' is a human act (corpus:approve --doc-template) after the regulatory
-- owner confirms the encoding matches the primary Annex text. Claude never
-- approves. Source: Regulation (EU) 2025/40 (PPWR), Annex VIII — CELEX 32025R0040, OJ L 2025/40, 22.1.2025
INSERT INTO "doc_templates"
  ("template_id","version","title","source_citation","source_url","elements","status","notes")
VALUES
  ('EU-DoC-AnnexVIII', 1, 'EU declaration of conformity', 'Regulation (EU) 2025/40 (PPWR), Annex VIII — CELEX 32025R0040, OJ L 2025/40, 22.1.2025', 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32025R0040',
   '[{"ref": "header", "fixedText": "EU declaration of conformity No (*1) …", "fillable": true, "fillLabel": "declaration identification number"}, {"ref": "1", "fixedText": "No … (unique identification of the packaging):", "fillable": true, "fillLabel": "unique identification of the packaging"}, {"ref": "2", "fixedText": "Name and address of the manufacturer and, where applicable, the manufacturer’s authorised representative:", "fillable": true, "fillLabel": "manufacturer and authorised representative — name and address"}, {"ref": "3", "fixedText": "This declaration of conformity is issued under the sole responsibility of the manufacturer.", "fillable": false}, {"ref": "4", "fixedText": "Object of the declaration (identification of the packaging allowing traceability): description of the packaging:", "fillable": true, "fillLabel": "description of the packaging"}, {"ref": "5", "fixedText": "The object of the declaration referred to point 4 is in conformity with the relevant Union harmonisation legislation: … (reference to the other Union acts applied).", "fillable": true, "fillLabel": "reference to the Union acts applied"}, {"ref": "6", "fixedText": "References to the relevant harmonised standards or the common specifications used or references to the other technical specifications in relation to which conformity is declared:", "fillable": true, "fillLabel": "standards / specifications referenced"}, {"ref": "7", "fixedText": "Where applicable, the notified body … (name, address, number) … performed … (description of intervention) … and issued the certificate(s): … (details, including the date of the certificate(s), and, where appropriate, information on the duration and conditions of validity).", "fillable": true, "fillLabel": "notified body details, if applicable"}, {"ref": "8", "fixedText": "Additional information:", "fillable": true, "fillLabel": "additional information"}, {"ref": "signature", "fixedText": "Signed for and on behalf of:\n\n(place and date of issue):\n\n(name, function) (signature):", "fillable": true, "fillLabel": "signature block — left blank for the manufacturer"}, {"ref": "footnote", "fixedText": "(*1)  (identification number of the declaration)", "fillable": false}]'::jsonb, 'draft', 'Encoded verbatim from the fetched EUR-Lex text (docs/reference/ppwr-annex-viii-2025-40.md). Seeded DRAFT — awaiting regulatory-owner confirmation that the encoding matches the Annex before promotion to approved.');
