import type { PackReport, CheckpointCard } from "../engine/pack.ts";
import type { AssessmentContextRecord } from "../../db/schema.ts";

// Eligibility for a DRAFT EU declaration of conformity. The draft is only offered
// when the screening actually supports it: every applicable in_force checkpoint is
// qualified, the technical-documentation checkpoint is satisfied, the manufacturer
// role is unambiguous, and destination Member States are set. Any failure returns
// a SPECIFIC blocking reason — the button is rendered disabled with the reason,
// never silently hidden. Pure.

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

  // 2. Manufacturer role must be unambiguous. An EU-established manufacturer is the
  //    unambiguous declarant. When the manufacturer is non-EU (or the fact is not
  //    recorded), the EU declarant chain (manufacturer / authorised representative /
  //    importer) is not unambiguous from this screening.
  const nonEu = context.legal_role_facts?.manufacturer_is_non_eu;
  if (nonEu === true) {
    blockers.push(
      "The manufacturer is not EU-established, so the party obligated to draw up the EU declaration " +
        "(manufacturer, authorised representative or importer) is not unambiguous from this screening.",
    );
  } else if (nonEu === undefined) {
    blockers.push("The manufacturer's establishment (EU / non-EU) is not recorded, so the declarant is not established.");
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
