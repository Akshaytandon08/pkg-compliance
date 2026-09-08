// Client-safe vocabulary — no Drizzle imports, so client components can use it
// without pulling the DB layer into the browser bundle. schema.ts re-exports the
// corpus vocabularies from here so there is one source of truth.

// `wood` splits into solid vs processed (Sprint 4b / B2). `wood` remains as the
// PARENT category: a checkpoint written for "wood" still applies to both subtypes
// (materialMatches / material hierarchy below), while ISPM-15 narrows to wood_solid.
export const MATERIALS = ["corrugated", "plastic", "wood", "wood_solid", "wood_processed", "metal", "all"] as const;

// Material hierarchy: a subtype rolls up to its parent for applicability. A
// checkpoint targeting the parent ("wood") applies to any child (wood_solid,
// wood_processed); a checkpoint targeting a child applies only to that child.
export const MATERIAL_PARENT: Record<string, string> = {
  wood_solid: "wood",
  wood_processed: "wood",
};

/** True when a checkpoint's material list covers a component's material, honouring
 *  the subtype→parent hierarchy (and the "all" wildcard). */
export function materialMatches(checkpointMaterials: readonly string[], componentMaterial: string): boolean {
  if (checkpointMaterials.includes("all") || checkpointMaterials.includes(componentMaterial)) return true;
  const parent = MATERIAL_PARENT[componentMaterial];
  return parent ? checkpointMaterials.includes(parent) : false;
}

/** Expand a set of component materials to include their parent categories, so a
 *  `bom_material_present: "wood"` condition is satisfied by a wood_solid component. */
export function expandMaterials(materials: readonly string[]): string[] {
  const out = new Set<string>(materials);
  for (const m of materials) {
    const parent = MATERIAL_PARENT[m];
    if (parent) out.add(parent);
  }
  return [...out];
}

export const LEGAL_ROLES = [
  "manufacturer",
  "importer",
  "distributor",
  "epr_producer",
] as const;

export const PACKAGING_LEVELS = [
  "sales",
  "inner",
  "outer",
  "transport",
  "pallet",
  "ecomm",
] as const;

export const EVIDENCE_TYPES = [
  "supplier_declaration",
  "lab_test",
  "registration",
  "marking",
  "technical_file",
  "test_report",
  "pigment_spec",
  "conformity_declaration",
] as const;

// --- UI-only vocabularies (intake form) ----------------------------------

// A single component is one material, so "all" is not offered at component level.
// The intake offers the wood SUBTYPES (solid vs processed), not the bare parent.
export const BOM_MATERIALS = ["corrugated", "plastic", "wood_solid", "wood_processed", "metal"] as const;

export const PERSONAS = [
  { value: "1", label: "Packaging manufacturer" },
  { value: "2a", label: "Tier-1 / white-label exporter" },
  { value: "2b", label: "OEM selling own goods in-geography" },
] as const;

export const CUSTOM_VS_STANDARDISED = ["custom", "standardised"] as const;
export const SPEC_DEFINED_BY = ["user", "customer", "supplier"] as const;

// Optional per-component assessor risk annotation — the human chemistry/design
// judgment the deterministic evaluator consumes as designAssessment. It never
// adjudicates on its own; unannotated components default to no_inherent_risk.
export const RISK_ANNOTATIONS = ["no_inherent_risk", "at_risk"] as const;

// Curated EU Member States for the destination multi-select (slice scope).
export const EU_MEMBER_STATES = [
  "DE",
  "FR",
  "IT",
  "ES",
  "NL",
  "BE",
  "PL",
  "SE",
  "AT",
  "IE",
] as const;

// Regime-level destination markets (superset of EU Member States). "EU" covers
// the Union-wide + Member-State layers; "IN" the Plastic Waste Management Rules.
export const DESTINATION_MARKETS = [
  { code: "EU", label: "European Union" },
  { code: "IN", label: "India" },
] as const;
