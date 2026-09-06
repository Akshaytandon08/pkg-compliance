import { createHash, randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "./index.ts";
import { passports } from "./schema.ts";
import { getAssessment, loadCorpusAsOf, type LoadedAssessment } from "./assessments.ts";
import { loadEmissionFactors } from "./factors.ts";
import { evaluatePack } from "../lib/engine/pack.ts";
import { computePackFootprint } from "../lib/engine/pcf.ts";

// The PUBLIC tier of an assessment — the only thing a passport ever exposes.
// Pack name (the title), an aggregate material summary, verdict COUNTS (never
// per-checkpoint detail), corpus version, and a PCF summary. No evidence, no
// component names, no client identifiers beyond the pack title. Counts come from
// the pinned in-force corpus, so nothing from a draft/contested checkpoint can
// appear here.
export type PassportPayload = {
  packName: string;
  corpusVersion: string;
  asOf: string;
  demo: boolean;
  materialComposition: { material: string; componentCount: number }[];
  counts: { qualified: number; conditional: number; gap: number; not_applicable: number; caveat: number };
  overallVerdict: string;
  pcf: { totalKgCo2e: number; unit: string; resolvedComponents: number; unresolvedComponents: number };
};

export async function buildPassportPayload(assessment: LoadedAssessment): Promise<PassportPayload> {
  const corpus = await loadCorpusAsOf(assessment.corpusVersion); // in_force only — no drafts
  const factors = await loadEmissionFactors();
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

  const resolved = footprint.components.filter((c) => c.kgCo2e != null).length;
  return {
    packName: assessment.packName,
    corpusVersion: assessment.corpusVersion,
    asOf: assessment.asOf,
    demo: assessment.demo,
    materialComposition,
    counts: report.counts,
    overallVerdict: report.overall.verdict,
    pcf: {
      // Rounded to 3 sig figs so float noise never perturbs the content hash.
      totalKgCo2e: Number(footprint.totalKgCo2e.toPrecision(3)),
      unit: "kg CO2e",
      resolvedComponents: resolved,
      unresolvedComponents: footprint.unresolved.length,
    },
  };
}

/** Stable stringify (sorted keys) so the content hash is order-independent. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function passportContentHash(payload: PassportPayload): string {
  return createHash("sha256").update(canonical(payload)).digest("hex");
}

function describeChange(prev: PassportPayload, next: PassportPayload): string {
  const bits: string[] = [];
  const c1 = prev.counts, c2 = next.counts;
  if (c1.qualified !== c2.qualified || c1.conditional !== c2.conditional || c1.gap !== c2.gap)
    bits.push(`counts ${c1.qualified}/${c1.conditional}/${c1.gap} → ${c2.qualified}/${c2.conditional}/${c2.gap} (Q/C/G)`);
  if (prev.pcf.totalKgCo2e !== next.pcf.totalKgCo2e)
    bits.push(`footprint ${prev.pcf.totalKgCo2e} → ${next.pcf.totalKgCo2e} kg CO2e`);
  if (prev.corpusVersion !== next.corpusVersion) bits.push(`corpus ${prev.corpusVersion} → ${next.corpusVersion}`);
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
