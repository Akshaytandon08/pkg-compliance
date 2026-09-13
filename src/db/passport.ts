import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./index.ts";
import {
  checkpointApprovals,
  checkpoints,
  corpusVersions,
  evidenceDocuments,
  extractedClaims,
  extractionRuns,
  passports,
} from "./schema.ts";
import { getAssessment, loadCorpusAsOf, type EvidenceRecord, type LoadedAssessment } from "./assessments.ts";
import { getOrganisation } from "./organisations.ts";
import { pinnedFactorSet } from "./factors.ts";
import { evaluatePack, type CheckpointCard, type ProductionCheckpoint } from "../lib/engine/pack.ts";
import type { EvidenceDocument } from "../lib/engine/evaluate.ts";
import { describeThreshold, evidenceTypeLabel } from "../lib/report/labels.ts";
import { computePackFootprint } from "../lib/engine/pcf.ts";

// The PUBLIC tier of an assessment (disclosure model v2). The rule set is public
// law, so the passport now shows WHICH rules are met, per checkpoint: id, the
// plain-language requirement, the verdict, a reason category, and the primary
// legal citation. Counts come from the pinned in-force corpus, so nothing from a
// draft/contested checkpoint appears.
//
// STAYS GATED (report only, never here): evidence document references,
// supplier/sourced-from identities, assessor risk-annotation rationale, component
// weights and full BOM composition, delta-action wording. The material summary is
// aggregate only ("corrugated ×3"); per-checkpoint rows are aggregated across
// components so no component identity leaks.
export type PassportReasonCategory =
  | "Evidence complete"
  | "Evidence pending"
  | "Test required"
  | "Design non-compliant"
  | "Not applicable"
  | "Not yet applicable";

export type PassportCheckpoint = {
  checkpointId: string;
  version: number;
  requirement: string; // plain-language requirement text (public law)
  verdict: "qualified" | "conditional" | "gap" | "not_applicable" | "upcoming";
  reasonCategory: PassportReasonCategory;
  citationText: string;
  citationUrl: string | null;
  // Public tier: confidence + citation only. Exemptions are flagged, never
  // detailed (the carve-out detail stays on the gated report).
  confidence: "H" | "M" | "L" | null;
  subjectToExemptions: boolean;

  // --- Passport v3-lite (Sprint 10). All OPTIONAL: passports are hash-chained,
  // and a version minted before these existed must still parse and verify. ---

  /** What actually satisfies the rule. Empty for a rule nothing satisfies yet. */
  proof?: {
    /** Joins to the evidence record; not rendered. */
    docId: string;
    evidenceType: string;
    evidenceTypeLabel: string;
    reference: string | null;
    validity: string | null;
    issuerName: string | null;
    issuerType: string | null;
    accreditationRef: string | null;
  }[];
  /** Measured value against the rule's limit, where BOTH exist. */
  keyValue?: {
    parameter: string;
    measured: string;
    measuredUnit: string | null;
    limitText: string;
  } | null;
  /** Who verified the RULE's encoding against primary law, and when. Always the
   *  regulatory owner — this is not a statement about the packaging. */
  ruleVerifiedBy?: { name: string; verifiedOn: string } | null;
  /** Who confirmed the EVIDENCE, and when, where that was recorded. */
  evidenceConfirmedBy?: { name: string; confirmedOn: string } | null;
  /** The verbatim legal text, hidden behind a disclosure. */
  fullRuleText?: string | null;
  /** Why a not-applicable rule does not apply, in plain words. */
  notApplicableReason?: string | null;
  /** Date an upcoming rule starts to apply. */
  appliesFrom?: string | null;
};

export type PassportPayload = {
  disclosureModel: "v2";
  packName: string;
  corpusVersion: string;
  asOf: string;
  demo: boolean;
  materialComposition: { material: string; componentCount: number }[];
  // `upcoming` is optional because passports are PERSISTED and hash-chained:
  // versions published before the temporal state existed have no such key and
  // must still parse and re-render. Absent reads as 0.
  counts: { qualified: number; conditional: number; gap: number; not_applicable: number; caveat: number; upcoming?: number };
  /** One line about the rule set's provenance, shown once (Sprint 10). Optional
   *  for hash-chain compatibility with passports minted before it existed. */
  corpus?: { asOf: string; releases: string[] } | null;
  /** Per-component traceability (Sprint 10). Optional, as above.
   *
   *  What is here: what it is, what it is made of, how much it weighs, where it
   *  was made, by whom, how much of it is recycled, what attests to it, and what
   *  its footprint rests on. What is NOT: any contact route, any document body,
   *  and no measured values beyond a rule's key-value line. */
  components?: {
    line: string;
    name: string;
    material: string;
    massKg: number | null;
    countryOfOrigin: string | null;
    supplierName: string | null;
    /** 0..1, or null for "not stated" — which is not the same as zero. */
    recycledShare: number | null;
    attestations: {
      evidenceTypeLabel: string;
      issuerName: string | null;
      issuerType: string | null;
      accreditationRef: string | null;
      issuedDate: string | null;
    }[];
    footprint: { kgCo2e: number; datasetName: string } | null;
    /** Why it has no footprint, when it has none. */
    footprintExcludedReason: string | null;
  }[];
  overallVerdict: string;
  checkpoints: PassportCheckpoint[];
  pcf: {
    totalKgCo2e: number;
    unit: string;
    resolvedComponents: number;
    unresolvedComponents: number;
    // Which datasets the COMPUTED RESULT rests on. Optional for the same reason
    // as `declarant` and `upcoming`: passports are hash-chained, and a version
    // minted before this existed must still parse and still verify.
    //
    // The source NAME is ours to publish — saying which dataset a figure came
    // from is attribution, and a figure whose origin is secret is not evidence
    // of anything. The factor VALUE is the dataset owner's licensed content, so
    // it appears here ONLY when the owner has read that dataset's terms and
    // recorded that they permit it (emission_factors.value_display_permitted).
    factorSources?: {
      material: string;
      source: string;
      sourceDataset: string | null;
      region: string;
      year: number;
      tier: string;
      /** Present only when the dataset's terms permit republishing the value. */
      value?: number;
      unit?: string;
    }[];
  };
  // The obligated economic operator this passport is published for. OPTIONAL for
  // the same reason as `upcoming`: passports are persisted and hash-chained, so
  // versions minted before organisations existed carry no declarant and must
  // still parse and verify. Absent means "not recorded", never "none".
  //
  // Identity and registration numbers only. An EPR registration number is a
  // public register entry — that is what a register is for — while the operator's
  // address and contact are NOT disclosed here: the public tier discloses the
  // rule set and who carries it, not a company's correspondence details.
  declarant?: {
    legalName: string;
    country: string;
    role?: string | null;
    registrations?: { jurisdiction: string; scheme: string; registerName?: string | null; registrationNumber: string }[];
  };
};

// `upcoming` ranks with not_applicable: a requirement that does not yet apply must
// never become a component's worst disclosed verdict.
const VERDICT_RANK: Record<string, number> = { not_applicable: 0, upcoming: 0, qualified: 1, conditional: 2, gap: 3 };

const REASON_CATEGORY: Record<string, PassportReasonCategory> = {
  EVIDENCE_COMPLETE: "Evidence complete",
  EVIDENCE_ABSENT: "Evidence pending",
  EVIDENCE_INCOMPLETE: "Evidence pending",
  EVIDENCE_EXPIRED: "Evidence pending",
  TEST_REQUIRED: "Test required",
  DESIGN_NONCOMPLIANT: "Design non-compliant",
  NOT_APPLICABLE_SCOPE: "Not applicable",
  UPCOMING_NOT_YET_APPLICABLE: "Not yet applicable",
};

// Split "pinpoint. https://…" into display text + primary-source URL.
function splitCitation(citation: string): { text: string; url: string | null } {
  const m = citation.match(/https?:\/\/\S+/);
  const url = m ? m[0].replace(/[.,;]$/, "") : null;
  const text = citation.replace(/https?:\/\/\S+/, "").replace(/\.?\s*$/, "").trim();
  return { text, url };
}

/**
 * The per-rule detail the v3-lite passport shows when a row is expanded.
 *
 * Everything here is derived from data the gated report already had; none of it
 * is new judgement. The decision this encodes is about DISCLOSURE, not about
 * evaluation — see the 2026-09-13 decision-log entry that widens the public tier.
 */
function passportDetail(
  card: CheckpointCard,
  verdict: string,
  packDocuments: EvidenceDocument[],
  recordByDocId: Map<string, EvidenceRecord>,
  corpusByKey: Map<string, ProductionCheckpoint>,
  verificationByKey: Map<string, { name: string; verifiedOn: string }>,
  confirmedClaims: ConfirmedClaim[],
): Partial<PassportCheckpoint> {
  const key = `${card.checkpointId}@${card.version}`;
  const corpus = corpusByKey.get(key);

  // PROOF — only for a rule the evidence actually satisfies. Listing documents
  // beside a gap would suggest they count for something; they do not.
  const accepted = new Set((card.evidenceRequirements.allOf ?? []).flatMap((c) => c.anyOf));
  const proof =
    verdict === "qualified"
      ? packDocuments
          .filter((d) => accepted.has(d.type))
          .map((d) => {
            const rec = recordByDocId.get(d.docId);
            return {
              docId: d.docId,
              evidenceType: d.type,
              evidenceTypeLabel: evidenceTypeLabel(d.type),
              reference: rec?.reference ?? null,
              validity: validityText(rec?.issuedDate ?? null, rec?.expiryDate ?? null),
              issuerName: rec?.issuerName ?? null,
              issuerType: rec?.issuerType ?? null,
              accreditationRef: rec?.accreditationRef ?? null,
            };
          })
      : [];

  // RULE VERIFIED BY — about the RULE's encoding against primary law, never
  // about the packaging. The wording on the page has to keep that distinction.
  // Read from the checkpoints table rather than the engine's ProductionCheckpoint,
  // which does not carry verification fields — and this sprint changes no engine
  // types.
  const ruleVerifiedBy = verificationByKey.get(key) ?? null;

  // KEY VALUE — a measured figure against the rule's own limit. Shown only where
  // BOTH exist: a confirmed claim for a parameter this rule sets a threshold on.
  // An unconfirmed claim never appears; "human-confirmed before it affects a
  // verdict" applies to what a reader is shown, not only to what the engine uses.
  // NOT gated on the verdict. A passport row is the WORST verdict across the
  // components a rule touches, so gating on `qualified` hid a measured value
  // behind a different component's missing paperwork. The measurement is a fact
  // about the packaging either way, and "17.0 against a 100 limit" is exactly
  // what a reader wants when the row says Conditional.
  const threshold = corpus?.thresholds?.[0] ?? null;
  const match = threshold
    ? confirmedClaims.find((c) => sameParameter(c.parameter, threshold.parameter) && c.value)
    : undefined;
  const keyValue =
    match && threshold
      ? {
          parameter: threshold.parameter,
          measured: match.value!,
          measuredUnit: match.unit,
          // The limit WITHOUT the parameter: the parameter is already the field's
          // own subject, and "Pb+Cd+Hg+Cr(VI) sum 17.0 mg/kg against Pb+Cd+Hg+Cr(VI)
          // sum ≤ 100 mg/kg" reads as a stutter.
          limitText: describeThreshold({ ...threshold, parameter: null }),
        }
      : null;

  // WHO CONFIRMED THE EVIDENCE — from the confirmed claim, which records both the
  // person and the moment.
  //
  // A MANUAL evidence record has no equivalent: `assessment_evidence` carries no
  // entered-by column, so for those rows this stays null rather than attributing
  // the record to whoever happens to be nearby. Adding the column is a schema
  // change and a decision for the owner; inventing attribution on a public page
  // is not a shortcut worth taking.
  const evidenceConfirmedBy =
    match?.confirmedBy && match.confirmedAt
      ? { name: match.confirmedBy, confirmedOn: match.confirmedAt.toISOString().slice(0, 10) }
      : null;

  return {
    proof,
    keyValue,
    ruleVerifiedBy,
    evidenceConfirmedBy,
    fullRuleText: corpus?.requirementText ?? card.requirementText,
    notApplicableReason: verdict === "not_applicable" ? (card.outcome?.detail ?? null) : null,
    appliesFrom: verdict === "upcoming" ? (card.outcome?.detail ?? null) : null,
  };
}

/**
 * Who verified each checkpoint's citation against primary law, and when. Read
 * straight from the corpus table: these columns exist there but are deliberately
 * not carried into the engine's ProductionCheckpoint, and this sprint adds no
 * engine fields.
 */
async function loadCitationVerification(): Promise<Map<string, { name: string; verifiedOn: string }>> {
  const rows = await db
    .select({
      id: checkpoints.id,
      version: checkpoints.version,
      by: checkpoints.citationVerifiedBy,
      on: checkpoints.citationVerifiedDate,
    })
    .from(checkpoints);
  const out = new Map<string, { name: string; verifiedOn: string }>();
  for (const r of rows) {
    if (r.by && r.on) out.set(`${r.id}@${r.version}`, { name: r.by, verifiedOn: r.on });
  }
  return out;
}

/**
 * The corpus releases that actually contributed the rules in this screening.
 *
 * Not `assessment.corpusVersion`, which is the single label stamped at creation:
 * a screening evaluated against batch-1 + batch-2-eu + batch-2-in was describing
 * itself as one of them. checkpoint_approvals is what records which release
 * approved each checkpoint, so the set is derived from the rules actually used.
 */
async function loadReleasesFor(cards: { checkpointId: string; version: number }[]): Promise<string[]> {
  if (cards.length === 0) return [];
  const rows = await db
    .select({ label: corpusVersions.label, id: checkpointApprovals.checkpointId, version: checkpointApprovals.checkpointVersion })
    .from(checkpointApprovals)
    .innerJoin(corpusVersions, eq(corpusVersions.id, checkpointApprovals.corpusVersionId));
  const used = new Set(cards.map((c) => `${c.checkpointId}@${c.version}`));
  const labels = new Set(rows.filter((r) => used.has(`${r.id}@${r.version}`)).map((r) => r.label));
  return [...labels].sort();
}

/** A confirmed extracted claim, reduced to what the key-value line needs. */
interface ConfirmedClaim {
  parameter: string | null;
  value: string | null;
  unit: string | null;
  confirmedBy: string | null;
  confirmedAt: Date | null;
}

/**
 * Confirmed claims for this assessment. CONFIRMED ONLY — an unconfirmed claim is
 * a proposal, and the rule that it must not reach a verdict applies equally to
 * what a reader is shown.
 */
async function loadConfirmedClaims(assessmentId: number): Promise<ConfirmedClaim[]> {
  return db
    .select({
      parameter: extractedClaims.parameter,
      value: extractedClaims.value,
      unit: extractedClaims.unit,
      confirmedBy: extractedClaims.confirmedBy,
      confirmedAt: extractedClaims.confirmedAt,
    })
    .from(extractedClaims)
    .innerJoin(extractionRuns, eq(extractionRuns.id, extractedClaims.runId))
    .innerJoin(evidenceDocuments, eq(evidenceDocuments.id, extractionRuns.documentId))
    .where(and(eq(evidenceDocuments.assessmentId, assessmentId), eq(extractedClaims.status, "confirmed")));
}

/** Does a claim's parameter answer this threshold's parameter? Compared on a
 *  normalised form so "Pb+Cd+Hg+Cr(VI) sum" matches however it is spaced. */
function sameParameter(claim: string | null, threshold: string): boolean {
  const norm = (v: string) => v.toLowerCase().replace(/[\s_]+/g, "");
  return !!claim && norm(claim) === norm(threshold);
}

/** "Issued 2026-03-14 · expires 2027-04-16", or whichever half exists. */
function validityText(issued: string | null, expiry: string | null): string | null {
  const parts = [issued ? `issued ${issued}` : null, expiry ? `expires ${expiry}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export async function buildPassportPayload(assessment: LoadedAssessment): Promise<PassportPayload> {
  const corpus = await loadCorpusAsOf(assessment.corpusVersion); // in_force only — no drafts
  const org = assessment.organisationId ? await getOrganisation(assessment.organisationId) : null;
  const factors = await pinnedFactorSet(assessment.id);
  const corpusByKey = new Map(corpus.map((c) => [`${c.id}@${c.version}`, c]));
  const verificationByKey = await loadCitationVerification();
  const confirmedClaims = await loadConfirmedClaims(assessment.id);
  const report = evaluatePack({
    checkpoints: corpus,
    context: assessment.context,
    components: assessment.components.map((c) => ({
      id: c.id,
      line: c.line,
      name: c.name,
      material: c.material,
      documents: c.documents,
      designAssessment:
        c.riskAnnotation === "at_risk" ? "at_risk" : c.riskAnnotation === "no_inherent_risk" ? "no_inherent_risk" : undefined,
    })),
    asOf: assessment.asOf,
    corpusVersion: assessment.corpusVersion,
  });
  const footprint = computePackFootprint(
    assessment.components.map((c) => ({ line: c.line, name: c.name, material: c.material, weightGrams: c.weightGrams })),
    factors,
    assessment.context.inbound_transport,
  );

  const byMaterial = new Map<string, number>();
  for (const c of assessment.components) byMaterial.set(c.material, (byMaterial.get(c.material) ?? 0) + 1);
  const materialComposition = [...byMaterial.entries()]
    .map(([material, componentCount]) => ({ material, componentCount }))
    .sort((a, b) => a.material.localeCompare(b.material));

  // Per-checkpoint public detail. A component-subject checkpoint yields one card
  // per component; aggregate them into a single row (worst verdict) so no
  // component identity leaks. Caveat cards (no verdict) are omitted.
  // Evidence records keyed by the engine's docId, so a card's relied-on
  // documents can be enriched with WHO issued them (Sprint 10). The engine's
  // EvidenceDocument is untouched; this joins to it on docId.
  const recordByDocId = new Map<string, (typeof assessment.components)[number]["evidenceRecords"][number]>();
  for (const c of assessment.components) for (const r of c.evidenceRecords) recordByDocId.set(r.docId, r);
  const packDocuments = assessment.components.flatMap((c) => c.documents);

  const grouped = new Map<string, { requirement: string; citation: string; version: number; worst: { verdict: string; reasonCode: string }; confidence: "H" | "M" | "L" | null; subjectToExemptions: boolean; card: (typeof allCards)[number] }>();
  const allCards = [
    ...report.componentSections.flatMap((s) => s.cards),
    ...report.packagingUnit,
    ...report.organisation,
    // Upcoming requirements ARE disclosed — the public tier is the rule set, and
    // "this applies to you from <date>" is exactly the kind of thing a reader
    // needs. They carry their own verdict and render under their own heading.
    ...report.upcoming,
  ];
  const releases = await loadReleasesFor(allCards);

  for (const card of allCards) {
    const outcome = card.outcome;
    if (!outcome) continue;
    const verdict = outcome.disposition === "not_applicable" ? "not_applicable" : outcome.verdict;
    if (!verdict) continue; // caveat / no verdict — not disclosed as a rule result
    const key = `${card.checkpointId}@${card.version}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        requirement: card.requirementText,
        citation: card.citation,
        version: card.version,
        worst: { verdict, reasonCode: outcome.reasonCode },
        confidence: card.confidence,
        subjectToExemptions: !!(card.exemptions && card.exemptions.length > 0),
        card,
      });
    } else if (VERDICT_RANK[verdict] > VERDICT_RANK[existing.worst.verdict]) {
      existing.worst = { verdict, reasonCode: outcome.reasonCode };
    }
  }
  const checkpoints: PassportCheckpoint[] = [...grouped.entries()]
    .map(([key, g]) => {
      const { text, url } = splitCitation(g.citation);
      return {
        checkpointId: key.split("@")[0],
        version: g.version,
        requirement: g.requirement,
        verdict: g.worst.verdict as PassportCheckpoint["verdict"],
        reasonCategory: REASON_CATEGORY[g.worst.reasonCode] ?? "Evidence pending",
        citationText: text,
        citationUrl: url,
        confidence: g.confidence,
        subjectToExemptions: g.subjectToExemptions,
        ...passportDetail(g.card, g.worst.verdict, packDocuments, recordByDocId, corpusByKey, verificationByKey, confirmedClaims),
      };
    })
    .sort((a, b) => VERDICT_RANK[b.verdict] - VERDICT_RANK[a.verdict] || a.checkpointId.localeCompare(b.checkpointId));

  const resolved = footprint.components.filter((c) => c.kgCo2e != null).length;

  // The datasets the published total actually rests on, deduplicated and sorted
  // so the content hash is order-independent. Attribution is always disclosed;
  // the licensed VALUE only where the owner recorded that the terms allow it.
  const usedFactors = new Map<number, { material: string; f: NonNullable<(typeof footprint.components)[number]["factor"]> }>();
  for (const c of footprint.components) {
    if (c.kgCo2e != null && c.factor) usedFactors.set(c.factor.id, { material: c.material, f: c.factor });
  }
  if (footprint.transport) {
    usedFactors.set(footprint.transport.factor.id, { material: "transport", f: footprint.transport.factor });
  }
  const factorSources = [...usedFactors.values()]
    .map(({ material, f }) => ({
      material,
      source: f.source,
      sourceDataset: f.sourceDataset,
      region: f.region,
      year: f.year,
      tier: f.tier as string,
      ...(f.valueDisplayPermitted ? { value: f.factor, unit: f.unit } : {}),
    }))
    .sort((a, b) => a.material.localeCompare(b.material) || a.source.localeCompare(b.source));
  return {
    disclosureModel: "v2",
    packName: assessment.packName,
    corpusVersion: assessment.corpusVersion,
    asOf: assessment.asOf,
    demo: assessment.demo,
    materialComposition,
    counts: report.counts,
    // Shown once on the page rather than per rule: the provenance of the RULE
    // SET, not of any one rule.
    corpus: { asOf: assessment.asOf, releases: releases.length > 0 ? releases : [assessment.corpusVersion] },
    components: assessment.components.map((c) => {
      const fp = footprint.components.find((f) => f.line === c.line);
      return {
        line: c.line,
        name: c.name,
        material: c.material,
        massKg: fp?.massKg ?? (c.weightGrams != null ? c.weightGrams / 1000 : null),
        countryOfOrigin: c.countryOfOrigin,
        supplierName: c.supplierName,
        recycledShare: c.recycledShare,
        attestations: c.evidenceRecords.map((r) => ({
          evidenceTypeLabel: evidenceTypeLabel(r.evidenceType),
          issuerName: r.issuerName,
          issuerType: r.issuerType,
          accreditationRef: r.accreditationRef,
          issuedDate: r.issuedDate,
        })),
        footprint:
          fp?.kgCo2e != null && fp.factor
            ? {
                kgCo2e: Number(fp.kgCo2e.toPrecision(3)),
                datasetName: fp.factor.sourceDataset
                  ? `${fp.factor.source} / ${fp.factor.sourceDataset}`
                  : fp.factor.source,
              }
            : null,
        footprintExcludedReason:
          fp?.kgCo2e == null
            ? fp?.unresolvedReason === "no_weight"
              ? "no mass on file"
              : "no emission factor selected for this material"
            : null,
      };
    }),
    overallVerdict: report.overall.verdict,
    checkpoints,
    // Omitted entirely when there is no organisation on file, so a passport with
    // no declarant hashes exactly as it did before this field existed.
    ...(org
      ? {
          declarant: {
            legalName: org.legalName,
            country: org.country,
            role: org.roleDefault,
            registrations: org.registrations.map((r) => ({
              jurisdiction: r.jurisdiction,
              scheme: r.scheme,
              registerName: r.registerName,
              registrationNumber: r.registrationNumber,
            })),
          },
        }
      : {}),
    pcf: {
      // Rounded to 3 sig figs so float noise never perturbs the content hash.
      totalKgCo2e: Number(footprint.totalKgCo2e.toPrecision(3)),
      unit: "kg CO2e",
      resolvedComponents: resolved,
      unresolvedComponents: footprint.unresolved.length,
      // Omitted when the total rests on nothing, so a passport for a pack with
      // no selected factors hashes as it did before this field existed.
      ...(factorSources.length > 0 ? { factorSources } : {}),
    },
  };
}

/** Stable stringify (sorted keys) so the content hash is order-independent. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // A key whose value is undefined is treated as ABSENT, exactly as JSON does.
    // Optional fields are added to this payload over time (`upcoming`,
    // `declarant`), and a caller that spreads one in as undefined must hash the
    // same as an older payload that never had the key — otherwise the chain
    // breaks on a field carrying no information.
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function passportContentHash(payload: PassportPayload): string {
  return createHash("sha256").update(canonical(payload)).digest("hex");
}

function describeChange(prev: PassportPayload, next: PassportPayload): string {
  // A disclosure-model change is the headline when it happens (e.g. v1 → v2,
  // which adds per-checkpoint detail).
  if (prev.disclosureModel !== next.disclosureModel) {
    return `Disclosure model ${next.disclosureModel} — per-checkpoint detail added.`;
  }
  const bits: string[] = [];
  const c1 = prev.counts, c2 = next.counts;
  if (c1.qualified !== c2.qualified || c1.conditional !== c2.conditional || c1.gap !== c2.gap)
    bits.push(`counts ${c1.qualified}/${c1.conditional}/${c1.gap} → ${c2.qualified}/${c2.conditional}/${c2.gap} (Q/C/G)`);
  if (prev.pcf.totalKgCo2e !== next.pcf.totalKgCo2e)
    bits.push(`footprint ${prev.pcf.totalKgCo2e} → ${next.pcf.totalKgCo2e} kg CO2e`);
  if (prev.corpusVersion !== next.corpusVersion) bits.push(`corpus ${prev.corpusVersion} → ${next.corpusVersion}`);
  if (prev.declarant?.legalName !== next.declarant?.legalName)
    bits.push(`declarant ${prev.declarant?.legalName ?? "none"} → ${next.declarant?.legalName ?? "none"}`);
  return bits.length ? `Regenerated — ${bits.join("; ")}.` : "Regenerated — content changed.";
}

export type PassportResult = {
  token: string;
  version: number;
  contentHash: string;
  changed: boolean; // false when regeneration found identical data (no new version)
};

/**
 * Creates the passport (v1) or, if the public-tier data has changed since the
 * last version, appends a new version chained by prev_hash. Regenerating with
 * identical data is a no-op that returns the current version. Token is generated
 * once and stays stable, so a printed QR keeps resolving.
 */
export async function generatePassport(assessmentId: number): Promise<PassportResult> {
  const assessment = await getAssessment(assessmentId);
  if (!assessment) throw new Error(`assessment ${assessmentId} does not exist`);
  const payload = await buildPassportPayload(assessment);
  const hash = passportContentHash(payload);

  const [latest] = await db
    .select()
    .from(passports)
    .where(eq(passports.assessmentId, assessmentId))
    .orderBy(desc(passports.version))
    .limit(1);

  if (!latest) {
    const token = randomBytes(16).toString("hex"); // unguessable; not the assessment id
    await db.insert(passports).values({
      assessmentId, token, version: 1, payload, contentHash: hash, prevHash: null, changelog: "Initial version",
    });
    return { token, version: 1, contentHash: hash, changed: true };
  }

  if (latest.contentHash === hash) {
    return { token: latest.token, version: latest.version, contentHash: hash, changed: false };
  }

  const version = latest.version + 1;
  await db.insert(passports).values({
    assessmentId,
    token: latest.token,
    version,
    payload,
    contentHash: hash,
    prevHash: latest.contentHash,
    changelog: describeChange(latest.payload as PassportPayload, payload),
  });
  return { token: latest.token, version, contentHash: hash, changed: true };
}

export type LoadedPassport = {
  token: string;
  version: number;
  payload: PassportPayload;
  contentHash: string;
  prevHash: string | null;
  changelog: string | null;
  createdAt: Date;
};

/** Latest version for a public token, or null. Read-only, safe for the public route. */
export async function getPassportByToken(token: string): Promise<LoadedPassport | null> {
  const [row] = await db
    .select()
    .from(passports)
    .where(eq(passports.token, token))
    .orderBy(desc(passports.version))
    .limit(1);
  if (!row) return null;
  return {
    token: row.token,
    version: row.version,
    payload: row.payload as PassportPayload,
    contentHash: row.contentHash,
    prevHash: row.prevHash,
    changelog: row.changelog,
    createdAt: row.createdAt,
  };
}
