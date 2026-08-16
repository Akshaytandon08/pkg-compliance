// Client-safe vocabulary — no Drizzle imports, so client components can use it
// without pulling the DB layer into the browser bundle. schema.ts re-exports the
// corpus vocabularies from here so there is one source of truth.

export const MATERIALS = ["corrugated", "plastic", "wood", "metal", "all"] as const;

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
export const BOM_MATERIALS = ["corrugated", "plastic", "wood", "metal"] as const;

export const PERSONAS = [
  { value: "1", label: "Packaging manufacturer" },
  { value: "2a", label: "Tier-1 / white-label exporter" },
  { value: "2b", label: "OEM selling own goods in-geography" },
] as const;

export const CUSTOM_VS_STANDARDISED = ["custom", "standardised"] as const;
export const SPEC_DEFINED_BY = ["user", "customer", "supplier"] as const;

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
