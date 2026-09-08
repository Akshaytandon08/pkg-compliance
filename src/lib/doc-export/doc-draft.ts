import type { DocBlock, DraftDocument } from "./model.ts";
import { FITSOL_BRAND } from "./model.ts";
import type { DocTemplateRecord } from "../../db/doc-templates.ts";
import type { PackReport } from "../engine/pack.ts";
import type { AssessmentContextRecord } from "../../db/schema.ts";
import { evaluatedCards } from "./eligibility.ts";

export const DRAFT_WATERMARK =
  "DRAFT — FOR SIGNATURE BY THE MANUFACTURER — prepared as a data-assembly aid; not a declaration until signed";

// The substantive PPWR requirement articles a DoC speaks to. The "not assessed"
// section lists any of these without in_force coverage in this screening.
const SUBSTANTIVE_ARTICLES = [5, 6, 7, 8, 9, 10, 11, 12];

/** First article number cited by a checkpoint (e.g. "…, Article 5 (…)" → 5). */
export function primaryArticle(citation: string): number | null {
  const m = citation.match(/Articles?\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

export interface DoCDraftInputs {
  template: DocTemplateRecord; // the APPROVED Annex VIII record (caller enforces approval)
  packName: string;
  draftVersion: number;
  context: AssessmentContextRecord;
  report: PackReport;
  components: { line: string; name: string; material: string; composition?: string | null; weightGrams?: number | null }[];
  language: string; // "en" first; others get a translation-to-verify notice
  generatedDate: string; // ISO date
}

function el(template: DocTemplateRecord, ref: string) {
  return template.elements.find((e) => e.ref === ref);
}

export function buildDoCDraft(input: DoCDraftInputs): DraftDocument {
  const { template, report, context } = input;
  const blocks: DocBlock[] = [];
  const cards = evaluatedCards(report);
  const passed = cards.filter((c) => c.outcome?.verdict === "qualified");

  const header = el(template, "header");
  blocks.push({ type: "wordmark" });
  blocks.push({ type: "title", text: template.title });
  if (header) blocks.push({ type: "subtitle", text: header.fixedText });
  blocks.push({
    type: "metaRows",
    rows: [
      ["Pack", input.packName],
      ["Draft version", String(input.draftVersion)],
      ["Corpus version", report.corpusVersion],
      ["Prepared", input.generatedDate],
      ["Destination Member State(s)", context.destination_member_states.join(", ") || "—"],
      ["Source structure", template.sourceCitation],
    ],
  });
  blocks.push({ type: "spacer" });

  // Element 1 — unique identification.
  const e1 = el(template, "1");
  if (e1) blocks.push({ type: "annexElement", ref: "1", fixedText: e1.fixedText, fill: e1.fillLabel });

  // Element 2 — manufacturer + AR (populate what the role facts establish; the
  // name/address is a field the manufacturer completes).
  const e2 = el(template, "2");
  if (e2) {
    blocks.push({ type: "annexElement", ref: "2", fixedText: e2.fixedText });
    const facts = context.legal_role_facts ?? {};
    const known = [
      facts.manufacturer_is_non_eu === false ? "EU-established manufacturer" : undefined,
      facts.packaging_branded ? "packaging is branded by the manufacturer" : undefined,
      facts.custom_vs_standardised ? `${facts.custom_vs_standardised} packaging` : undefined,
    ].filter(Boolean) as string[];
    blocks.push({ type: "field", label: `manufacturer name and address${known.length ? ` (screening notes: ${known.join("; ")})` : ""}, and authorised representative if any` });
  }

  // Element 3 — fixed statement (sole responsibility of the manufacturer).
  const e3 = el(template, "3");
  if (e3) blocks.push({ type: "annexElement", ref: "3", fixedText: e3.fixedText });

  // Element 4 — object of declaration, then the materials-and-weights BOM table.
  const e4 = el(template, "4");
  if (e4) blocks.push({ type: "annexElement", ref: "4", fixedText: e4.fixedText, fill: e4.fillLabel });
  blocks.push({
    type: "table",
    caption: "Packaging composition (from the assessed bill of materials)",
    columns: ["Line", "Component", "Material", "Composition", "Weight (g)"],
    rows: input.components.map((c) => [c.line, c.name, c.material, c.composition ?? "—", c.weightGrams != null ? String(c.weightGrams) : "—"]),
  });

  // Element 5 — conformity with Union legislation, then the ARTICLE-BY-ARTICLE
  // statement from the in_force checkpoints that PASSED in this screening.
  const e5 = el(template, "5");
  if (e5) blocks.push({ type: "annexElement", ref: "5", fixedText: e5.fixedText, fill: e5.fillLabel });

  const byArticle = new Map<number, string[]>();
  for (const c of passed) {
    const a = primaryArticle(c.citation);
    if (a == null) continue;
    (byArticle.get(a) ?? byArticle.set(a, []).get(a)!).push(c.requirementText);
  }
  blocks.push({ type: "heading", text: "Conformity assessed by this screening — article by article" });
  if (byArticle.size > 0) {
    blocks.push({
      type: "articleLines",
      items: [...byArticle.entries()]
        .sort((x, y) => x[0] - y[0])
        .map(([a, reqs]) => ({ article: String(a), text: `${reqs.length} requirement${reqs.length === 1 ? "" : "s"} qualified in this screening — ${reqs[0]}${reqs.length > 1 ? " …" : ""}` })),
    });
  } else {
    blocks.push({ type: "paragraph", muted: true, text: "No article reached a qualified verdict in this screening." });
  }

  // Articles 5–12 without in_force coverage — stated explicitly, never implied conform.
  const covered = new Set<number>();
  for (const c of cards) {
    const a = primaryArticle(c.citation);
    if (a != null) covered.add(a);
  }
  const notAssessed = SUBSTANTIVE_ARTICLES.filter((a) => !covered.has(a));
  blocks.push({ type: "heading", text: "Articles not assessed by this screening" });
  if (notAssessed.length > 0) {
    blocks.push({ type: "paragraph", muted: true, text: "The following PPWR articles were NOT evaluated in this screening and are not covered by the statement above. The manufacturer must address them separately before signing:" });
    blocks.push({ type: "bullets", items: notAssessed.map((a) => `Article ${a}`) });
  } else {
    blocks.push({ type: "paragraph", muted: true, text: "All of Articles 5–12 have in-force coverage in this screening's corpus." });
  }

  // Element 6 — standards / specifications, then the referenced test methods.
  const e6 = el(template, "6");
  if (e6) blocks.push({ type: "annexElement", ref: "6", fixedText: e6.fixedText, fill: e6.fillLabel });
  const standards = [...new Set(passed.map((c) => c.testMethod).filter((m): m is string => Boolean(m)))];
  if (standards.length > 0) {
    blocks.push({ type: "bullets", items: standards });
  } else {
    blocks.push({ type: "paragraph", muted: true, text: "No standard or test method is referenced by the qualified requirements in this screening." });
  }

  // Element 7 — notified body (field).
  const e7 = el(template, "7");
  if (e7) blocks.push({ type: "annexElement", ref: "7", fixedText: e7.fixedText, fill: e7.fillLabel });

  // Element 8 — additional information (field).
  const e8 = el(template, "8");
  if (e8) blocks.push({ type: "annexElement", ref: "8", fixedText: e8.fixedText, fill: e8.fillLabel });

  // Signature block — rendered blank.
  const sig = el(template, "signature");
  if (sig) blocks.push({ type: "signatureBlock", lines: sig.fixedText.split("\n").map((l) => l.trim()).filter(Boolean) });

  // Footnote.
  const foot = el(template, "footnote");
  if (foot) blocks.push({ type: "paragraph", muted: true, text: foot.fixedText });

  // Non-English versions carry a translation-to-verify notice.
  if (input.language.toLowerCase() !== "en") {
    blocks.push({
      type: "notice",
      text: `This ${input.language.toUpperCase()} version is provided for convenience. The legal text is reproduced in English (the language of the Annex); any translation must be verified by the manufacturer before signing.`,
    });
  }

  return {
    watermark: DRAFT_WATERMARK,
    diagonalWatermark: "DRAFT — NOT SIGNED",
    brand: FITSOL_BRAND,
    blocks,
    title: `Draft — ${template.title} — ${input.packName}`,
    language: input.language,
  };
}
