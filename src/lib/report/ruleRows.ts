import type { CheckpointCard, ProductionCheckpoint } from "../engine/pack.ts";
import { guidanceKey, type GuidanceRow } from "../../db/guidance.ts";
import type { EvidenceDocument } from "../engine/evaluate.ts";
import type { Verdict } from "../engine/verdict.ts";
import { describeDeltaAction, describeRequirement } from "./deltaActions.ts";
import {
  CONFIDENCE_LABEL,
  describeThreshold,
  evidenceTypeLabel,
  reasonLabel,
  ruleName,
  ruleReference,
  verdictAriaLabel,
  verdictLabel,
} from "./labels.ts";

// The report table's view model, built on the SERVER so the table component can
// stay a dumb client component: every string is resolved here, and no engine
// code or corpus row is shipped to the browser.

/** One extracted claim, as the drawer shows it. */
export interface ClaimSummary {
  parameter: string | null;
  value: string | null;
  issuer: string | null;
  status: string;
  page: number | null;
}

export interface EvidenceRelied {
  docId: string;
  type: string;
  typeLabel: string;
  reference: string | null;
  /** Truncated for the chip; `reference` keeps the full text for the drawer. */
  shortReference: string | null;
  validity: string | null;
  /** "extracted" evidence came from a document read by the pipeline; a reviewer
   *  can open it. "manual" is a typed record. Drives the chip's glyph. */
  source: "manual" | "extracted";
  sourceDocumentId: number | null;
  // --- drawer detail ---
  issuedDate: string | null;
  expiryDate: string | null;
  scope: { components: string[]; materials: string[]; parameters: string[] };
  /** Short-lived signed URL for the stored file, when there is one. */
  sourceUrl: string | null;
  /** Extracted claims for this component. NOTE: matched by component, not by
   *  evidence row — the loaded evidence does not carry extracted_claim_id, and
   *  adding it would be a schema change. Labelled as such in the drawer. */
  claims: ClaimSummary[];
}

export interface EvidenceContext {
  /** documentId → signed source URL. */
  sourceLinks?: Map<number, string>;
  /** componentId → extracted claims. */
  claimsByComponent?: Map<number, ClaimSummary[]>;
  componentId?: number;
}

/** Approved "how to obtain this evidence" guidance, resolved to plain data so the
 *  client table can render it without reaching for the database. Carried into the
 *  expanded row because the card layout it replaced showed it, and losing it
 *  would regress the Sprint-2b report loop. */
export interface RuleGuidance {
  typeLabel: string;
  pending: boolean;
  issuerGuidance: string | null;
  mustContain: string[];
  redFlags: string[];
}

export interface RuleRow {
  key: string;
  checkpointId: string;
  version: number;
  name: string;
  reference: string;
  verdict: Verdict | null;
  verdictText: string;
  verdictAria: string;
  why: string;
  /** Informational rows (not yet applicable, or awaiting approval) are muted and
   *  carry NO action: there is nothing for the user to do about them today. */
  informational: boolean;
  reliedOn: EvidenceRelied[];
  requiredText: string | null;
  citationText: string;
  citationUrl: string | null;
  action: string | null;
  // --- revealed by expanding the row ---
  requirementText: string;
  thresholds: string[];
  exemptions: { scope: string; basis: string }[];
  phaseIn: string | null;
  confidence: string | null;
  assessorFlag: string | null;
  guidance: RuleGuidance[];
  /** Evidence types this rule accepts — the Add-evidence control offers these. */
  acceptedEvidenceTypes: string[];
  /** "Request evidence" — pre-filled request templates, resolved server-side. */
  requestTemplates: { label: string; docxUrl: string; pdfUrl: string }[];
}

/** Split "pinpoint text. https://…" into display text + primary-source URL. */
function splitCitation(citation: string): { text: string; url: string | null } {
  const m = citation.match(/https?:\/\/\S+/);
  const url = m ? m[0].replace(/[.,;]$/, "") : null;
  const text = citation.replace(/https?:\/\/\S+/, "").replace(/\s*\.\s*$/, "").trim();
  return { text: text || citation, url };
}

/** The chip shows a short reference; the full text lives in the drawer. Demo
 *  references run to a full sentence, which otherwise forces the Citation and
 *  Action columns off the side of the table. */
function shortRef(reference: string | null | undefined): string | null {
  if (!reference) return null;
  const head = reference.split(/\s+[—–-]\s+/)[0].trim();
  return head.length > 28 ? `${head.slice(0, 27)}…` : head;
}

function validityOf(doc: EvidenceDocument): string | null {
  if (doc.expiryDate) return `valid to ${doc.expiryDate}`;
  if (doc.issuedDate) return `issued ${doc.issuedDate}`;
  return null;
}

/**
 * Evidence a qualified row rests on: the on-file documents whose type is one the
 * requirement accepts. This filters by type rather than re-deciding CNF
 * satisfaction — that decision belongs to the engine, and duplicating it in the
 * view is how the two drift apart. Where more than one acceptable document is on
 * file, all are listed; each is genuinely relevant evidence.
 */
export function toEvidenceRelied(d: EvidenceDocument, ctx: EvidenceContext = {}): EvidenceRelied {
  const extracted = d.source === "extracted";
  return {
    docId: d.docId,
    type: d.type,
    typeLabel: evidenceTypeLabel(d.type),
    reference: d.reference ?? null,
    shortReference: shortRef(d.reference),
    validity: validityOf(d),
    source: extracted ? "extracted" : "manual",
    sourceDocumentId: d.sourceDocumentId ?? null,
    issuedDate: d.issuedDate ?? null,
    expiryDate: d.expiryDate ?? null,
    scope: {
      components: d.scope?.components ?? [],
      materials: d.scope?.materials ?? [],
      parameters: d.scope?.parameters ?? [],
    },
    sourceUrl: d.sourceDocumentId != null ? (ctx.sourceLinks?.get(d.sourceDocumentId) ?? null) : null,
    claims: extracted && ctx.componentId != null ? (ctx.claimsByComponent?.get(ctx.componentId) ?? []) : [],
  };
}

function reliedOnFor(card: CheckpointCard, documents: EvidenceDocument[], ctx: EvidenceContext): EvidenceRelied[] {
  const accepted = new Set((card.evidenceRequirements.allOf ?? []).flatMap((c) => c.anyOf));
  return documents.filter((d) => accepted.has(d.type)).map((d) => toEvidenceRelied(d, ctx));
}

export interface BuildRowsInput {
  cards: CheckpointCard[];
  /** Documents in scope for these rows (a component's, or the pack aggregate). */
  documents: EvidenceDocument[];
  /** Corpus rows keyed `id@version`, for fields the card does not carry
   *  (thresholds). Read at page level — the engine is unchanged. */
  corpusByKey: Map<string, ProductionCheckpoint>;
  /** Assessor annotation for the component these rows belong to, if any. */
  assessorFlag?: string | null;
  /** Approved evidence guidance, keyed by guidanceKey(). */
  guidance?: Map<string, GuidanceRow>;
  /** Needed to build the request-template URLs; omit for pack/organisation rows. */
  assessmentId?: number;
  componentId?: number;
  /** Signed links + claims, so an evidence chip can open a populated drawer. */
  evidenceContext?: EvidenceContext;
}

/** Request templates a rule can offer, as resolved URLs. */
function requestTemplatesFor(
  card: CheckpointCard,
  accepted: string[],
  assessmentId?: number,
  componentId?: number,
): RuleRow["requestTemplates"] {
  if (assessmentId == null || componentId == null) return [];
  const base = `/api/assessments/${assessmentId}/template?component=${componentId}&checkpoint=${encodeURIComponent(card.checkpointId)}&version=${card.version}`;
  const out: RuleRow["requestTemplates"] = [];
  if (accepted.includes("supplier_declaration")) {
    out.push({ label: "Supplier declaration request", docxUrl: `${base}&kind=supplier_declaration&format=docx`, pdfUrl: `${base}&kind=supplier_declaration&format=pdf` });
  }
  if (accepted.includes("lab_test") || accepted.includes("test_report")) {
    out.push({ label: "Lab test request", docxUrl: `${base}&kind=lab_test&format=docx`, pdfUrl: `${base}&kind=lab_test&format=pdf` });
  }
  return out;
}

export function buildRuleRows({ cards, documents, corpusByKey, assessorFlag, guidance, assessmentId, componentId, evidenceContext }: BuildRowsInput): RuleRow[] {
  const evCtx: EvidenceContext = { ...evidenceContext, componentId: componentId ?? evidenceContext?.componentId };
  return cards.map((card, i) => {
    const outcome = card.outcome;
    const verdict = outcome?.verdict ?? null;
    const key = `${card.checkpointId}@${card.version}`;
    const corpus = corpusByKey.get(key);
    const { text: citationText, url: citationUrl } = splitCitation(card.citation);

    // Informational: not yet applicable, or no verdict at all (a caveat).
    const informational = outcome?.disposition === "upcoming" || !verdict;
    const qualified = verdict === "qualified";
    const accepted = [...new Set((card.evidenceRequirements.allOf ?? []).flatMap((c) => c.anyOf))];
    const needsEvidence = verdict === "conditional" || verdict === "gap";

    return {
      key: `${key}-${card.componentLine ?? "pack"}-${i}`,
      checkpointId: card.checkpointId,
      version: card.version,
      name: ruleName(card.checkpointId),
      reference: ruleReference(card.checkpointId, card.version),
      verdict,
      verdictText: verdict
        ? verdictLabel(verdict, outcome?.detail)
        : (card.caveat?.label ?? "Pending approval"),
      verdictAria: verdict
        ? verdictAriaLabel(verdict, ruleName(card.checkpointId), outcome?.detail)
        : `${ruleName(card.checkpointId)}: ${card.caveat?.label ?? "Pending approval"}`,
      why: outcome ? reasonLabel(outcome.reasonCode, outcome.detail) : (card.caveat?.reason ?? ""),
      informational,
      reliedOn: qualified ? reliedOnFor(card, documents, evCtx) : [],
      requiredText: needsEvidence ? `Provide any one of: ${describeRequirement(card.evidenceRequirements)}` : null,
      citationText,
      citationUrl,
      // A future or unapproved requirement gets no action — there is nothing to do
      // about it today, and offering one would misrepresent the obligation.
      action: informational ? null : describeDeltaAction(card),
      requirementText: card.requirementText,
      thresholds: (corpus?.thresholds ?? []).map((t) => describeThreshold(t)).filter(Boolean),
      exemptions: (card.exemptions ?? []).map((e) => ({ scope: e.scope, basis: e.basis_pinpoint })),
      phaseIn: card.laterOfCondition ?? null,
      confidence: card.confidence ? (CONFIDENCE_LABEL[card.confidence] ?? card.confidence) : null,
      assessorFlag: assessorFlag ?? null,
      acceptedEvidenceTypes: accepted,
      // Only where evidence is actually outstanding. A qualified row does not
      // need a request template, and an informational row has nothing to request.
      requestTemplates: needsEvidence ? requestTemplatesFor(card, accepted, assessmentId, componentId) : [],
      guidance: guidance
        ? [...new Set((card.evidenceRequirements.allOf ?? []).flatMap((c) => c.anyOf))]
            .map((t) => ({ t, g: guidance.get(guidanceKey(card.checkpointId, card.version, t)) }))
            .filter((e): e is { t: string; g: GuidanceRow } => !!e.g)
            .map(({ t, g }) => ({
              typeLabel: evidenceTypeLabel(t),
              pending: g.status === "draft",
              issuerGuidance: g.issuerGuidance,
              mustContain: g.mustContain ?? [],
              redFlags: g.redFlags ?? [],
            }))
        : [],
    };
  });
}
