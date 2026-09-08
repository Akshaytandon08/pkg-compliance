import type { PackReport, CheckpointCard } from "../engine/pack.ts";
import type { AssessmentContextRecord } from "../../db/schema.ts";
import { userMayDrawUp } from "./manufacturer.ts";

// Eligibility for a DRAFT EU declaration of conformity. The draft is only offered
// when the screening actually supports it: every applicable in_force checkpoint is
// qualified, the technical-documentation checkpoint is satisfied, the manufacturer
// derivation points to a single party that is the assessing user (or the user
// declares they act for that manufacturer), and destination Member States are set.
// EU establishment is NOT a gate — a non-EU party is still the manufacturer and still
// draws up the DoC (Art 15); it only adds a note (Arts 18, 44–45). Any failure
// returns a SPECIFIC blocking reason — the button is rendered disabled with the
// reason, never silently hidden. Pure.

export const TECH_DOC_CHECKPOINT = "EU-PPWR-technical-documentation";
// The declaration-of-conformity checkpoint is the obligation this draft FULFILS.
// Requiring a signed DoC to already exist before drafting one is circular, so it is
// excluded from the "all applicable requirements qualified" gate. (Uploading the
// signed DoC back later, as conformity_declaration evidence, is what qualifies it.)
export const DOC_ITSELF_CHECKPOINT = "EU-PPWR-declaration-of-conformity";

export interface Eligibility {
  eligible: boolean;
  blockers: string[];
}

/** All in_force (evaluated-verdict) cards across the report. */
export function evaluatedCards(report: PackReport): CheckpointCard[] {
  const all = [
    ...report.componentSections.flatMap((s) => s.cards),
    ...report.packagingUnit,
    ...report.organisation,
  ];
  return all.filter((c) => c.outcome?.disposition === "verdict");
}

export function assessDoCEligibility(context: AssessmentContextRecord, report: PackReport): Eligibility {
  const blockers: string[] = [];

  // 1. Destination Member States must be set.
  if (!context.destination_member_states || context.destination_member_states.length === 0) {
    blockers.push("Destination Member States are not set for this assessment.");
  }

  // 2. The manufacturer derivation (FAQ rules) must point to a single party that is
  //    the assessing user, OR the user must have declared they act for that
  //    manufacturer. The blocker names the actual ambiguity — never "not EU-established".
  const { ok: mayDrawUp, derivation } = userMayDrawUp(context.legal_role_facts);
  if (!mayDrawUp) {
    blockers.push(`The manufacturer is not your organisation: ${derivation.reason ?? derivation.basis} You can only draw up the declaration as the manufacturer, or by declaring you act for them.`);
  }

  // 3 & 4. Every applicable in_force checkpoint must be qualified, and the
  //        technical-documentation checkpoint specifically must be satisfied.
  const cards = evaluatedCards(report);
  const notQualified = cards.filter(
    (c) => c.checkpointId !== DOC_ITSELF_CHECKPOINT && c.outcome?.verdict && c.outcome.verdict !== "qualified",
  );
  if (notQualified.length > 0) {
    const ids = [...new Set(notQualified.map((c) => `${c.checkpointId} (${c.outcome?.verdict})`))];
    blockers.push(`Not every applicable requirement is qualified yet: ${ids.join(", ")}.`);
  }

  const techDoc = cards.find((c) => c.checkpointId === TECH_DOC_CHECKPOINT);
  if (!techDoc) {
    blockers.push("The technical-documentation requirement (Article 15) is not in force for this assessment's corpus.");
  } else if (techDoc.outcome?.verdict !== "qualified") {
    blockers.push("The technical-documentation requirement (Article 15) is not satisfied.");
  }

  return { eligible: blockers.length === 0, blockers };
}
