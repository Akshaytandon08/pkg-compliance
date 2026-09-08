import { deriveEvidenceState, type EvidenceDocument } from "../engine/evaluate.ts";
import type { EvidenceRequirement } from "../../db/schema.ts";
import type { EvidenceState } from "../engine/verdict.ts";
import type { ExtractedClaimDraft } from "./types.ts";

// A5 — deterministic claim → checkpoint matching. Given the claims read from ONE
// document, the assessment's components and its applicable checkpoints, this
// proposes which checkpoints the document could help close — as PENDING
// attachments a human must confirm. It never confirms, never edits a verdict, and
// never invents scope. The scope + expiry test is the SAME code the evaluator
// uses (deriveEvidenceState), so a proposal is judged exactly as real evidence
// would be: a document whose claim is expired shows as `expired`, not "closes".

// Which corpus evidence_type a claim implies. A claim_type not in this table
// carries no evidence_type (metadata like issuer/scope) and yields no proposal —
// silence, never a fabricated attachment. Keyed to the EVIDENCE_TYPES vocab.
export const EVIDENCE_TYPE_BY_CLAIM: Record<string, string> = {
  recycled_content: "supplier_declaration",
  restricted_substance: "supplier_declaration",
  certification_scheme: "supplier_declaration",
  chain_of_custody: "supplier_declaration",
  grade: "supplier_declaration",
  measured_parameter: "test_report",
  stated_limit: "test_report",
  test_method: "test_report",
  accreditation: "test_report",
  heat_treatment: "marking",
  ispm15_mark: "marking",
};

export interface MatchComponent {
  id: number;
  name: string;
  material: string;
}

export interface MatchCheckpoint {
  id: string;
  // 'component' checkpoints are scoped per component; 'pack'/'organisation' are not.
  subject: "component" | "pack" | "organisation" | string;
  requirement: EvidenceRequirement | null;
}

export interface ProposedAttachment {
  evidenceType: string;
  componentId: number | null;
  componentName: string | null;
  claimIndexes: number[]; // indexes into the input claims array
  expiry: string | null;
  // A proposal is ALWAYS pending — a human confirms before it can affect a verdict.
  status: "pending_confirmation";
  // Whether the proposed document is already expired as of the assessment date.
  expired: boolean;
  // The applicable checkpoints this attachment would move, with before/after state
  // from the real evaluator. Only checkpoints whose state actually improves (or
  // would but for expiry) are listed — no speculative matches.
  checkpoints: { id: string; before: EvidenceState; after: EvidenceState }[];
}

// Resolve which components a document's claims scope to. A document uploaded
// against a specific component scopes to it; otherwise match components whose
// material name appears in a claim's material/scope text. No match → unscoped
// (null), which the evaluator treats as covering — surfaced for the human to narrow.
function resolveComponents(
  claims: ExtractedClaimDraft[],
  documentComponentId: number | null,
  components: MatchComponent[],
): (MatchComponent | null)[] {
  if (documentComponentId != null) {
    const c = components.find((x) => x.id === documentComponentId);
    return c ? [c] : [null];
  }
  const haystack = claims
    .flatMap((c) => [c.value, c.parameter, c.scopeText])
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const matched = components.filter((c) => haystack.includes(c.material.toLowerCase()));
  return matched.length > 0 ? matched : [null];
}

function earliestExpiry(claims: ExtractedClaimDraft[]): string | null {
  const dates = claims.map((c) => c.expiry).filter((d): d is string => Boolean(d));
  return dates.length > 0 ? dates.sort()[0] : null;
}

export interface ProposeInput {
  claims: ExtractedClaimDraft[];
  documentComponentId?: number | null;
  components: MatchComponent[];
  checkpoints: MatchCheckpoint[];
  existingDocuments: EvidenceDocument[];
  asOf: string;
}

/**
 * Propose pending evidence attachments from a document's claims. Deterministic;
 * no LLM, no mutation. Groups claims by the evidence_type they imply and by
 * resolved component, then asks the real evaluator whether adding such a document
 * would move each applicable checkpoint's evidence state.
 */
export function proposeEvidenceAttachments(input: ProposeInput): ProposedAttachment[] {
  const { claims, components, checkpoints, existingDocuments, asOf } = input;
  const documentComponentId = input.documentComponentId ?? null;

  // Group claim indexes by the evidence_type they imply.
  const byType = new Map<string, number[]>();
  claims.forEach((claim, i) => {
    const evidenceType = EVIDENCE_TYPE_BY_CLAIM[claim.claimType];
    if (!evidenceType) return; // metadata claim — no attachment
    (byType.get(evidenceType) ?? byType.set(evidenceType, []).get(evidenceType)!).push(i);
  });

  const proposals: ProposedAttachment[] = [];

  for (const [evidenceType, claimIndexes] of byType) {
    const typeClaims = claimIndexes.map((i) => claims[i]);
    const expiry = earliestExpiry(typeClaims);
    const expired = expiry != null && expiry < asOf;

    for (const component of resolveComponents(typeClaims, documentComponentId, components)) {
      const proposedDoc: EvidenceDocument = {
        docId: "proposed",
        type: evidenceType,
        expiryDate: expiry,
        scope: component ? { components: [component.name], materials: [component.material] } : null,
      };

      const moved: ProposedAttachment["checkpoints"] = [];
      for (const cp of checkpoints) {
        if (!cp.requirement) continue;
        const facts =
          cp.subject === "component" && component
            ? { componentName: component.name, material: component.material, asOf }
            : { asOf };
        const before = deriveEvidenceState(cp.requirement, existingDocuments, facts);
        const after = deriveEvidenceState(cp.requirement, [...existingDocuments, proposedDoc], facts);
        // List the checkpoint only if this document changes its state — i.e. it is
        // genuinely relevant. (A past-expiry document changes absent→expired, which
        // still surfaces so the human sees WHY it does not close the gap.)
        if (after !== before) moved.push({ id: cp.id, before, after });
      }

      if (moved.length > 0) {
        proposals.push({
          evidenceType,
          componentId: component?.id ?? null,
          componentName: component?.name ?? null,
          claimIndexes,
          expiry,
          status: "pending_confirmation",
          expired,
          checkpoints: moved,
        });
      }
    }
  }

  return proposals;
}
