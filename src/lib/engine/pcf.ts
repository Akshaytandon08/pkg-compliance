// Screening-grade cradle-to-gate PCF (Stack D). Deterministic arithmetic only —
// no LLM anywhere in the calculation. Per-component footprint = mass × material
// factor; an optional inbound transport leg = total mass × distance × transport
// factor. Every figure carries the factor's source + data-quality tier so the
// report can show provenance. A component with no weight or no matching factor
// is left UNRESOLVED (never silently zeroed) and excluded from the total.
//
// Sprint 9: there is no longer any fallback factor. A material the owner has not
// selected a factor for resolves to NOTHING — `no_factor` — and the report says
// "No factor selected". The previous behaviour (a seeded order-of-magnitude
// guess) made every pack look costed when none of them were.

import { MATERIAL_PARENT, type FactorTier } from "../vocab.ts";

export type EmissionFactor = {
  id: number;
  material: string;
  process: string;
  /** Version within (material, process). Pinned per assessment. */
  version: number;
  factor: number;
  unit: string;
  tier: FactorTier;
  source: string;
  sourceDataset: string | null;
  activityId: string | null;
  /** Provider data release (Climatiq data_version) this value came from. */
  dataVersion: string | null;
  region: string;
  year: number;
  methodology: string | null;
  /** What the dataset's terms say about republishing the value. */
  licenceNote: string | null;
  /** Whether those terms permit showing the VALUE on the public passport. */
  valueDisplayPermitted: boolean;
};

/** A row on tier `none` records that the owner searched and chose nothing. It is
 *  NOT a factor: it resolves exactly like an absent row, and exists so the
 *  decision is visible in the store rather than inferred from a gap. */
export function isUsableFactor(f: EmissionFactor | null | undefined): f is EmissionFactor {
  return !!f && f.tier !== "none";
}

export type PcfComponentInput = {
  line: string;
  name: string;
  material: string;
  weightGrams: number | null;
  /** Recycled content 0..1. NULL means NOT STATED, which is not the same as 0:
   *  a component nobody asked is costed at the primary (virgin) factor and says
   *  so, rather than being credited with a recycled share it never claimed. */
  recycledShare?: number | null;
};

export type ComponentFootprint = {
  line: string;
  name: string;
  material: string;
  massKg: number | null;
  /** The PRIMARY factor. Kept as `factor` so every existing reader still works. */
  factor: EmissionFactor | null;
  kgCo2e: number | null; // null when unresolved (no weight or no factor)
  unresolvedReason?: "no_weight" | "no_factor";
  /** How this component's factor was arrived at (Sprint 12). */
  blend: FactorBlend | null;
};

/**
 * Recycled-content blend: `primary × (1 − r) + closed_loop × r`.
 *
 * Every case is represented explicitly rather than collapsing to "primary" with
 * no explanation, because the REASON a component was costed at the virgin factor
 * is the part a reader needs — "nobody stated a share" and "the supplier stated
 * none" are different facts, and "we have no closed-loop factor for this
 * material" is a third.
 */
export type FactorBlend = {
  /** The factor actually used, per kg. */
  effective: number;
  primary: EmissionFactor;
  closedLoop: EmissionFactor | null;
  /** 0..1, or null when the component does not state one. */
  recycledShare: number | null;
  reason:
    | "blended"                  // r stated and a closed-loop factor exists
    | "share_not_stated"         // r is null
    | "share_zero"               // r === 0, stated
    | "no_closed_loop_factor";   // r stated, but the material has no closed-loop row
};

export type TransportLeg = {
  mode: string;
  km: number;
  massKg: number;
  factor: EmissionFactor;
  kgCo2e: number;
};

export type PackFootprint = {
  components: ComponentFootprint[];
  transport: TransportLeg | null;
  totalKgCo2e: number; // sum of resolvable legs only
  resolvedMassKg: number;
  unresolved: string[]; // component names lacking a weight or a factor
};

/** The process key a closed-loop (recycled-source) factor is stored under. Kept
 *  distinct from "production" so the two live as separate rows on the same
 *  material and BOTH can be pinned. */
export const CLOSED_LOOP_PROCESS = "production_closed_loop";

/**
 * The factor a component is actually costed at, and why.
 *
 * `r` is never invented: a component that does not state a recycled share is
 * costed at the primary factor and labelled as unstated. Blending an assumed
 * share would understate a footprint on the strength of nothing.
 */
export function blendFor(
  primary: EmissionFactor,
  closedLoop: EmissionFactor | null,
  recycledShare: number | null | undefined,
): FactorBlend {
  const r = recycledShare ?? null;
  if (r === null) {
    return { effective: primary.factor, primary, closedLoop, recycledShare: null, reason: "share_not_stated" };
  }
  if (!closedLoop) {
    return { effective: primary.factor, primary, closedLoop: null, recycledShare: r, reason: "no_closed_loop_factor" };
  }
  if (r === 0) {
    return { effective: primary.factor, primary, closedLoop, recycledShare: 0, reason: "share_zero" };
  }
  // Rounded to 12 significant figures for the same reason the unit conversion is
  // (src/lib/factors/units.ts): binary floating point otherwise puts an artefact
  // tail on a number that reaches a customer's report.
  const effective = Number((primary.factor * (1 - r) + closedLoop.factor * r).toPrecision(12));
  return { effective, primary, closedLoop, recycledShare: r, reason: "blended" };
}

/** The closed-loop (recycled-source) factor for a material, if one is selected.
 *  Absent is the normal case and is NOT an error — it means the blend cannot be
 *  computed and the component is costed at the primary factor, with a note. */
function closedLoopFactor(factors: EmissionFactor[], material: string): EmissionFactor | null {
  const exact = factors.find((f) => f.material === material && f.process === CLOSED_LOOP_PROCESS);
  if (isUsableFactor(exact)) return exact;
  if (exact) return null; // an explicit `none` is a decision, not a gap to fill
  const parent = MATERIAL_PARENT[material];
  if (!parent) return null;
  const inherited = factors.find((f) => f.material === parent && f.process === CLOSED_LOOP_PROCESS);
  return isUsableFactor(inherited) ? inherited : null;
}

/** Production factor for a material, if the owner has selected a usable one. */
function productionFactor(factors: EmissionFactor[], material: string): EmissionFactor | null {
  const exact = factors.find((f) => f.material === material && f.process === "production");
  if (isUsableFactor(exact)) return exact;
  // An explicit `none` on the exact material is a DECISION and stops here — it
  // must not be quietly rescued by the parent category's factor.
  if (exact) return null;
  // Otherwise fall back to the parent material (e.g. wood_solid → wood) when a
  // subtype-specific factor has not been selected.
  const parent = MATERIAL_PARENT[material];
  if (!parent) return null;
  const inherited = factors.find((f) => f.material === parent && f.process === "production");
  return isUsableFactor(inherited) ? inherited : null;
}

export function computePackFootprint(
  components: PcfComponentInput[],
  factors: EmissionFactor[],
  inboundTransport?: { mode: string; km: number } | null,
): PackFootprint {
  const out: ComponentFootprint[] = [];
  const unresolved: string[] = [];
  let total = 0;
  let resolvedMassKg = 0;

  for (const c of components) {
    const massKg = c.weightGrams != null && c.weightGrams > 0 ? c.weightGrams / 1000 : null;
    const factor = productionFactor(factors, c.material);
    if (massKg == null) {
      out.push({ line: c.line, name: c.name, material: c.material, massKg: null, factor, kgCo2e: null, unresolvedReason: "no_weight", blend: null });
      unresolved.push(c.name);
      continue;
    }
    if (!factor) {
      out.push({ line: c.line, name: c.name, material: c.material, massKg, factor: null, kgCo2e: null, unresolvedReason: "no_factor", blend: null });
      unresolved.push(c.name);
      continue;
    }
    // The RECYCLED-CONTENT BLEND. A component's factor is the primary one only
    // when it states no recycled share, states zero, or the material has no
    // closed-loop factor selected — each of which the blend records as its reason.
    const blend = blendFor(factor, closedLoopFactor(factors, c.material), c.recycledShare);
    const kgCo2e = massKg * blend.effective;
    out.push({ line: c.line, name: c.name, material: c.material, massKg, factor, kgCo2e, blend });
    total += kgCo2e;
    resolvedMassKg += massKg;
  }

  let transport: TransportLeg | null = null;
  if (inboundTransport && inboundTransport.km > 0 && resolvedMassKg > 0) {
    const factor = factors.find((f) => f.material === "transport" && f.process === inboundTransport.mode);
    if (isUsableFactor(factor)) {
      const kgCo2e = resolvedMassKg * inboundTransport.km * factor.factor;
      transport = { mode: inboundTransport.mode, km: inboundTransport.km, massKg: resolvedMassKg, factor, kgCo2e };
      total += kgCo2e;
    }
  }

  return { components: out, transport, totalKgCo2e: total, resolvedMassKg, unresolved };
}
