import { createHash, randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "./index.ts";
import { passports } from "./schema.ts";
import { getAssessment, loadCorpusAsOf, type LoadedAssessment } from "./assessments.ts";
import { getOrganisation } from "./organisations.ts";
import { pinnedFactorSet } from "./factors.ts";
import { evaluatePack } from "../lib/engine/pack.ts";
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

export async function buildPassportPayload(assessment: LoadedAssessment): Promise<PassportPayload> {
  const corpus = await loadCorpusAsOf(assessment.corpusVersion); // in_force only — no drafts
  const org = assessment.organisationId ? await getOrganisation(assessment.organisationId) : null;
  const factors = await pinnedFactorSet(assessment.id);
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
  const grouped = new Map<string, { requirement: string; citation: string; version: number; worst: { verdict: string; reasonCode: string }; confidence: "H" | "M" | "L" | null; subjectToExemptions: boolean }>();
  const allCards = [
    ...report.componentSections.flatMap((s) => s.cards),
    ...report.packagingUnit,
    ...report.organisation,
    // Upcoming requirements ARE disclosed — the public tier is the rule set, and
    // "this applies to you from <date>" is exactly the kind of thing a reader
    // needs. They carry their own verdict and render under their own heading.
    ...report.upcoming,
  ];
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
