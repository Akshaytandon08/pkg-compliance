// Production evaluation path: checkpoints from the DB, gated by evaluability so
// that drafts and contested rules render as visible caveats — never verdicts.
// Wraps the pure `evaluateCheckpoint` core; the gate lives here only.

import { evaluability } from "../corpus/evaluability.ts";
import type { CheckpointStatus } from "../corpus/evaluability.ts";
import type { Threshold, EvidenceRequirement, Recurrence, Exemption } from "../../db/schema.ts";
import {
  evaluateCheckpoint,
  type AssessmentContext,
  type CheckpointOutcome,
  type EvidenceDocument,
} from "./evaluate.ts";
import type { DesignAssessment, Verdict } from "./verdict.ts";

export type CheckpointSubject = "component" | "packaging_unit" | "organisation";

export type ProductionCheckpoint = {
  id: string;
  version: number;
  status: CheckpointStatus;
  subject: CheckpointSubject;
  material: string[];
  legalRole: string[];
  requirementText: string;
  evidenceRequirements: EvidenceRequirement;
  appliesWhen: Record<string, unknown> | null;
  thresholds: Threshold[] | null;
  recurrence: Recurrence | null;
  citation: string;
  triggerDate: string | null;
  sunsetDate: string | null;
  testMethod: string | null;
  notes: string | null;
  // Validation-report controls (rendered on the report where present).
  confidence: "H" | "M" | "L" | null;
  laterOfCondition: string | null;
  exemptions: Exemption[] | null;
};

export type ComponentInput = {
  id?: number;
  line: string;
  name: string;
  material: string;
  composition?: string;
  documents: EvidenceDocument[];
  // Optional assessor risk annotation → designAssessment. Absent = unannotated;
  // the evaluator defaults to no_inherent_risk and the report says so explicitly.
  designAssessment?: DesignAssessment;
  riskRationale?: string | null;
  riskAnnotatedBy?: string | null;
};

export type CaveatInfo = { label: string; reason: string };

export type CheckpointCard = {
  checkpointId: string;
  version: number;
  subject: CheckpointSubject;
  requirementText: string;
  citation: string;
  testMethod: string | null;
  evidenceRequirements: EvidenceRequirement;
  componentLine?: string;
  componentName?: string;
  outcome: CheckpointOutcome | null; // null when the card is a caveat
  caveat?: CaveatInfo;
  confidence: "H" | "M" | "L" | null;
  laterOfCondition: string | null;
  exemptions: Exemption[] | null;
};

export type PackReport = {
  corpusVersion: string;
  asOf: string;
  componentSections: { component: ComponentInput; cards: CheckpointCard[] }[];
  packagingUnit: CheckpointCard[];
  organisation: CheckpointCard[];
  caveats: CheckpointCard[];
  counts: {
    qualified: number;
    conditional: number;
    gap: number;
    not_applicable: number;
    caveat: number;
  };
  overall: { verdict: Verdict | "pending"; evaluatedCount: number };
};

// How a checkpoint should render in the report given its status/window.
type Gate =
  | { kind: "evaluate" }
  | { kind: "caveat"; caveat: CaveatInfo }
  | { kind: "hidden" };

function gateForReport(cp: ProductionCheckpoint, asOf: string): Gate {
  const ev = evaluability(
    {
      id: cp.id,
      version: cp.version,
      status: cp.status,
      triggerDate: cp.triggerDate,
      sunsetDate: cp.sunsetDate,
      citation: cp.citation,
    },
    asOf,
  );
  if (ev.evaluable) return { kind: "evaluate" };

  switch (cp.status) {
    case "draft":
      return {
        kind: "caveat",
        caveat: {
          label: "Pending regulatory approval",
          reason: "This checkpoint is a draft in the corpus and has not been approved for verdicts.",
        },
      };
    case "contested":
      return {
        kind: "caveat",
        caveat: { label: "Under legal challenge", reason: ev.reason },
      };
    case "upcoming":
      return { kind: "caveat", caveat: { label: "Not yet in force", reason: ev.reason } };
    case "in_force":
      // in_force but out of window: forward flag before trigger; hidden after sunset.
      return ev.reason.startsWith("Applies from")
        ? { kind: "caveat", caveat: { label: "Not yet in force", reason: ev.reason } }
        : { kind: "hidden" };
    default:
      return { kind: "hidden" }; // superseded
  }
}

const SEVERITY: Record<Verdict, number> = {
  qualified: 1,
  not_applicable: 0,
  conditional: 2,
  gap: 3,
};

export type EvaluatePackInput = {
  checkpoints: ProductionCheckpoint[];
  context: AssessmentContext;
  components: ComponentInput[];
  asOf: string;
  corpusVersion: string;
};

/**
 * Evaluates a pack against the corpus. Production defaults `designAssessment` to
 * `no_inherent_risk` (no extraction yet), so verdicts are evidence-driven. When
 * every checkpoint is draft the report is all caveats ("pending regulatory
 * approval") — correct behaviour, and it flips to verdicts on approval with no
 * code change (the only difference is checkpoint.status).
 */
export function evaluatePack(input: EvaluatePackInput): PackReport {
  const { checkpoints, context, components, asOf, corpusVersion } = input;
  const bomMaterials = [...new Set(components.map((c) => c.material))];

  const componentSections = components.map((component) => ({ component, cards: [] as CheckpointCard[] }));
  const sectionByLine = new Map(componentSections.map((s) => [s.component.line, s]));
  const packagingUnit: CheckpointCard[] = [];
  const organisation: CheckpointCard[] = [];
  const caveats: CheckpointCard[] = [];
  const counts = { qualified: 0, conditional: 0, gap: 0, not_applicable: 0, caveat: 0 };

  const baseCard = (cp: ProductionCheckpoint): Omit<CheckpointCard, "outcome"> => ({
    checkpointId: cp.id,
    version: cp.version,
    subject: cp.subject,
    requirementText: cp.requirementText,
    citation: cp.citation,
    testMethod: cp.testMethod,
    evidenceRequirements: cp.evidenceRequirements,
    confidence: cp.confidence,
    laterOfCondition: cp.laterOfCondition,
    exemptions: cp.exemptions,
  });

  const tally = (outcome: CheckpointOutcome) => {
    if (outcome.disposition === "verdict" && outcome.verdict) counts[outcome.verdict]++;
    else if (outcome.disposition === "not_applicable") counts.not_applicable++;
    else counts.caveat++;
  };

  const appliesToComponent = (cp: ProductionCheckpoint, material: string) =>
    cp.material.includes("all") || cp.material.includes(material);

  for (const cp of checkpoints) {
    const gate = gateForReport(cp, asOf);
    if (gate.kind === "hidden") continue;

    if (gate.kind === "caveat") {
      const card: CheckpointCard = { ...baseCard(cp), outcome: null, caveat: gate.caveat };
      caveats.push(card);
      counts.caveat++;
      continue;
    }

    // Evaluate (in_force, in window).
    if (cp.subject === "component") {
      for (const component of components) {
        if (!appliesToComponent(cp, component.material)) continue;
        const outcome = evaluateCheckpoint({
          appliesWhen: cp.appliesWhen,
          evidenceRequirements: cp.evidenceRequirements,
          // Assessor annotation drives design risk; default no_inherent_risk.
          designAssessment: component.designAssessment ?? "no_inherent_risk",
          documents: component.documents,
          context,
          bomMaterials,
          componentName: component.name,
          material: component.material,
          asOf,
        });
        const card: CheckpointCard = {
          ...baseCard(cp),
          componentLine: component.line,
          componentName: component.name,
          outcome,
        };
        if (outcome.disposition === "caveat") caveats.push(card);
        else sectionByLine.get(component.line)?.cards.push(card);
        tally(outcome);
      }
    } else {
      const outcome = evaluateCheckpoint({
        appliesWhen: cp.appliesWhen,
        evidenceRequirements: cp.evidenceRequirements,
        designAssessment: "no_inherent_risk",
        documents: [],
        context,
        bomMaterials,
        asOf,
      });
      const card: CheckpointCard = { ...baseCard(cp), outcome };
      if (outcome.disposition === "caveat") caveats.push(card);
      else if (cp.subject === "packaging_unit") packagingUnit.push(card);
      else organisation.push(card);
      tally(outcome);
    }
  }

  // Overall = worst evaluated verdict; not_applicable/caveats do not escalate.
  const evaluatedVerdicts = [...componentSections.flatMap((s) => s.cards), ...packagingUnit, ...organisation]
    .map((c) => c.outcome?.verdict)
    .filter((v): v is Verdict => v === "qualified" || v === "conditional" || v === "gap");
  const overallVerdict = evaluatedVerdicts.length
    ? evaluatedVerdicts.reduce((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), "qualified" as Verdict)
    : "pending";

  return {
    corpusVersion,
    asOf,
    componentSections,
    packagingUnit,
    organisation,
    caveats,
    counts,
    overall: { verdict: overallVerdict, evaluatedCount: evaluatedVerdicts.length },
  };
}
