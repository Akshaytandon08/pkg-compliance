import { and, desc, eq, inArray, isNull, sql as raw } from "drizzle-orm";
import { db } from "./index.ts";
import { assessmentFactorPins, assessments, emissionFactors } from "./schema.ts";
import type { EmissionFactor } from "../lib/engine/pcf.ts";
import type { FactorTier } from "../lib/vocab.ts";

// The emission-factor store. Three rules hold this file together:
//
//   1. Nothing writes a factor except a human running scripts/factors-select.ts.
//   2. Selecting a factor APPENDS a version; it never overwrites. An assessment
//      that was evaluated against version 1 keeps rendering version 1.
//   3. A `primary` (Fitsol's own) factor outranks a `secondary_database` one for
//      the same (material, process). Nothing else breaks the tie — the owner's
//      own measurement wins over a published average, always.

const TIER_RANK: Record<FactorTier, number> = { primary: 2, secondary_database: 1, none: 0 };

function toEngineFactor(r: typeof emissionFactors.$inferSelect): EmissionFactor {
  return {
    id: r.id,
    material: r.material,
    process: r.process,
    version: r.version,
    factor: r.factor,
    unit: r.unit,
    tier: r.tier as FactorTier,
    source: r.source,
    sourceDataset: r.sourceDataset,
    activityId: r.activityId,
    region: r.region,
    year: r.year,
    methodology: r.methodology,
    licenceNote: r.licenceNote,
    valueDisplayPermitted: r.valueDisplayPermitted,
  };
}

/**
 * The factor set as it stands TODAY: for each (material, process), the highest
 * version, and where a primary and a secondary factor both exist, the primary.
 * Rows on tier `none` are returned too — they are a recorded decision ("we
 * looked and chose nothing"), and the engine treats them as no factor.
 */
export async function currentFactorSet(database: typeof db = db): Promise<EmissionFactor[]> {
  const rows = await database.select().from(emissionFactors);
  const best = new Map<string, typeof rows[number]>();
  for (const r of rows) {
    const key = `${r.material}::${r.process}`;
    const held = best.get(key);
    if (!held) {
      best.set(key, r);
      continue;
    }
    const tierDelta = (TIER_RANK[r.tier as FactorTier] ?? 0) - (TIER_RANK[held.tier as FactorTier] ?? 0);
    if (tierDelta > 0 || (tierDelta === 0 && r.version > held.version)) best.set(key, r);
  }
  return [...best.values()].map(toEngineFactor);
}

/**
 * The factor set an assessment is evaluated against — PINNED on first use.
 *
 * A screening is a dated artefact. Re-opening a report after the owner selects a
 * better factor must not silently move the number that was reported, so the
 * first evaluation records exactly which factor rows it used and every later
 * render reads those rows back.
 *
 * `assessments.factors_pinned_at` is what distinguishes "never evaluated" from
 * "evaluated, and no factor existed for any material" — without it an empty pin
 * set would be ambiguous, and the second case would silently re-pin later.
 */
export async function pinnedFactorSet(
  assessmentId: number,
  database: typeof db = db,
): Promise<EmissionFactor[]> {
  const [assessment] = await database
    .select({ pinnedAt: assessments.factorsPinnedAt })
    .from(assessments)
    .where(eq(assessments.id, assessmentId));
  if (!assessment) return [];

  if (assessment.pinnedAt) {
    const rows = await database
      .select()
      .from(emissionFactors)
      .innerJoin(assessmentFactorPins, eq(assessmentFactorPins.factorId, emissionFactors.id))
      .where(eq(assessmentFactorPins.assessmentId, assessmentId));
    return rows.map((r) => toEngineFactor(r.emission_factors));
  }

  // First evaluation: pin what is current. Guarded so two concurrent renders
  // cannot both pin — the second sees pinnedAt set and reads the first's rows.
  const current = await currentFactorSet(database);
  await database.transaction(async (tx) => {
    const [claimed] = await tx
      .update(assessments)
      .set({ factorsPinnedAt: new Date() })
      .where(and(eq(assessments.id, assessmentId), isNull(assessments.factorsPinnedAt)))
      .returning({ id: assessments.id });
    if (!claimed) return; // another render pinned first; its set is authoritative
    if (current.length > 0) {
      await tx
        .insert(assessmentFactorPins)
        .values(current.map((f) => ({ assessmentId, factorId: f.id })));
    }
  });
  return pinnedFactorSet(assessmentId, database);
}

export interface FactorSelection {
  material: string;
  process: string;
  factor: number;
  unit: string;
  tier: FactorTier;
  source: string;
  sourceDataset?: string | null;
  activityId?: string | null;
  region: string;
  year: number;
  methodology?: string | null;
  retrievedAt?: Date | null;
  licenceNote?: string | null;
  valueDisplayPermitted?: boolean;
  selectedBy: string;
  notes?: string | null;
}

/**
 * Record the owner's chosen factor as a NEW VERSION of (material, process).
 * Called only from scripts/factors-select.ts — see that file's human-only note.
 */
export async function selectFactor(
  selection: FactorSelection,
  database: typeof db = db,
): Promise<{ id: number; version: number }> {
  return database.transaction(async (tx) => {
    const [latest] = await tx
      .select({ version: emissionFactors.version })
      .from(emissionFactors)
      .where(
        and(eq(emissionFactors.material, selection.material), eq(emissionFactors.process, selection.process)),
      )
      .orderBy(desc(emissionFactors.version))
      .limit(1);
    const version = (latest?.version ?? 0) + 1;
    const [row] = await tx
      .insert(emissionFactors)
      .values({
        material: selection.material,
        process: selection.process,
        version,
        factor: selection.factor,
        unit: selection.unit,
        tier: selection.tier,
        source: selection.source,
        sourceDataset: selection.sourceDataset ?? null,
        activityId: selection.activityId ?? null,
        region: selection.region,
        year: selection.year,
        methodology: selection.methodology ?? null,
        retrievedAt: selection.retrievedAt ?? new Date(),
        licenceNote: selection.licenceNote ?? null,
        valueDisplayPermitted: selection.valueDisplayPermitted ?? false,
        selectedBy: selection.selectedBy,
        notes: selection.notes ?? null,
      })
      .returning({ id: emissionFactors.id, version: emissionFactors.version });
    return row;
  });
}

/** Every version of every factor, newest first — the owner's audit view. */
export async function listFactorHistory(database: typeof db = db) {
  return database
    .select()
    .from(emissionFactors)
    .orderBy(emissionFactors.material, emissionFactors.process, desc(emissionFactors.version));
}

/** How many assessments have pinned a given factor row (so it is never deleted). */
export async function pinCount(factorId: number, database: typeof db = db): Promise<number> {
  const [row] = await database
    .select({ n: raw<number>`count(*)::int` })
    .from(assessmentFactorPins)
    .where(inArray(assessmentFactorPins.factorId, [factorId]));
  return row?.n ?? 0;
}
