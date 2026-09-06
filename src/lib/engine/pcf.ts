// Screening-grade cradle-to-gate PCF (Stack D). Deterministic arithmetic only —
// no LLM anywhere in the calculation. Per-component footprint = mass × material
// factor; an optional inbound transport leg = total mass × distance × transport
// factor. Every figure carries the factor's source + data-quality tier so the
// report can show provenance. A component with no weight or no matching factor
// is left UNRESOLVED (never silently zeroed) and excluded from the total.

export type EmissionFactor = {
  material: string;
  process: string;
  factor: number;
  unit: string;
  source: string;
  year: number;
  geography: string;
  dataQuality: string;
};

export type PcfComponentInput = {
  line: string;
  name: string;
  material: string;
  weightGrams: number | null;
};

export type ComponentFootprint = {
  line: string;
  name: string;
  material: string;
  massKg: number | null;
  factor: EmissionFactor | null;
  kgCo2e: number | null; // null when unresolved (no weight or no factor)
  unresolvedReason?: "no_weight" | "no_factor";
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

/** Production factor for a material, if one exists. */
function productionFactor(factors: EmissionFactor[], material: string): EmissionFactor | null {
  return factors.find((f) => f.material === material && f.process === "production") ?? null;
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
      out.push({ line: c.line, name: c.name, material: c.material, massKg: null, factor, kgCo2e: null, unresolvedReason: "no_weight" });
      unresolved.push(c.name);
      continue;
    }
    if (!factor) {
      out.push({ line: c.line, name: c.name, material: c.material, massKg, factor: null, kgCo2e: null, unresolvedReason: "no_factor" });
      unresolved.push(c.name);
      continue;
    }
    const kgCo2e = massKg * factor.factor;
    out.push({ line: c.line, name: c.name, material: c.material, massKg, factor, kgCo2e });
    total += kgCo2e;
    resolvedMassKg += massKg;
  }

  let transport: TransportLeg | null = null;
  if (inboundTransport && inboundTransport.km > 0 && resolvedMassKg > 0) {
    const factor = factors.find((f) => f.material === "transport" && f.process === inboundTransport.mode);
    if (factor) {
      const kgCo2e = resolvedMassKg * inboundTransport.km * factor.factor;
      transport = { mode: inboundTransport.mode, km: inboundTransport.km, massKg: resolvedMassKg, factor, kgCo2e };
      total += kgCo2e;
    }
  }

  return { components: out, transport, totalKgCo2e: total, resolvedMassKg, unresolved };
}
