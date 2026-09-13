// Two guards between a provider's search result and a stored factor. Both exist
// because the shortlists showed that the dangerous candidates look exactly like
// the right ones.
//
//   1. UNITS. The engine computes mass_in_kg × factor, so a factor must be per
//      KILOGRAM. Climatiq returns BEIS rows as kg/tonne and EPA rows as
//      kg/short ton. Storing 1193.96586 kg/tonne verbatim would have made a
//      900 g carton read 1,074 kg CO2e instead of 1.07 — a 1000× error that
//      looks like a plausible number on a pallet-scale pack.
//
//   2. SYSTEM BOUNDARY. A search for "PET" returns more waste-disposal rows than
//      production rows. `gate_to_grave` and `end_of_life` factors are not
//      cradle-to-gate production factors; they answer a different question, and
//      6.41 kg/tonne for "PET waste disposal (closed-loop)" would quietly turn a
//      footprint into something that is not a footprint.
//
// Both refuse rather than guess. A unit we do not recognise is not silently
// passed through, because "unrecognised" and "per kilogram" are indistinguishable
// once the number is in the table.

/** Exact conversions to kg CO2e per kg. No approximations, no rounding. */
const PER_KG_DIVISOR: Record<string, number> = {
  "kg/kg": 1,
  "kg/t": 1000,
  "kg/tonne": 1000,
  "kg/metric ton": 1000,
  // NIST: 1 short ton = 907.18474 kg exactly.
  "kg/short ton": 907.18474,
  "g/kg": 0.001,
};

/** The unit the engine and the emission_factors table use for a production row. */
export const CANONICAL_MASS_UNIT = "kgCO2e/kg";

export interface UnitConversion {
  factor: number;
  unit: typeof CANONICAL_MASS_UNIT;
  /** Human-readable record of what was done, stored on the factor's notes. */
  note: string | null;
}

export class UnitError extends Error {}

/**
 * Convert a provider's (value, unit) pair to kg CO2e per kg, or refuse.
 *
 * The conversion is recorded in `note` so a reviewer reading the stored row can
 * see that the number was divided and by what — an unexplained 1.19 where the
 * provider publishes 1193.97 is exactly the kind of discrepancy that destroys
 * trust in a figure.
 */
export function toPerKilogram(value: number, unit: string | null | undefined): UnitConversion {
  const key = (unit ?? "").trim().toLowerCase();
  const divisor = PER_KG_DIVISOR[key];
  if (divisor === undefined) {
    throw new UnitError(
      `Unit "${unit ?? "(none)"}" is not a recognised mass-based emission-factor unit. ` +
        `The engine multiplies mass in kg by the factor, so only these convert safely: ` +
        `${Object.keys(PER_KG_DIVISOR).join(", ")}. Refusing rather than storing a number ` +
        `whose scale is unknown.`,
    );
  }
  if (!Number.isFinite(value)) throw new UnitError(`Factor value "${value}" is not a finite number.`);
  if (divisor === 1) return { factor: value, unit: CANONICAL_MASS_UNIT, note: null };
  return {
    factor: value / divisor,
    unit: CANONICAL_MASS_UNIT,
    note: `Converted from ${value} ${unit} (÷ ${divisor}) to ${CANONICAL_MASS_UNIT}.`,
  };
}

/** System boundaries that answer the question a cradle-to-gate screening asks. */
export const PRODUCTION_BOUNDARIES = ["cradle_to_gate", "cradle_to_shelf"] as const;

/**
 * Is this row a production factor? `null` (the provider did not state a
 * boundary) is NOT treated as acceptable: an unstated boundary on a factor that
 * will be labelled "cradle-to-gate" on a customer's report is an assumption, and
 * the owner should have to make it deliberately (--allow-boundary).
 */
export function isProductionBoundary(lcaActivity: string | null | undefined): boolean {
  return (PRODUCTION_BOUNDARIES as readonly string[]).includes(lcaActivity ?? "");
}

/** A carbon-storage variant reports NEGATIVE embodied carbon (sequestration) and
 *  is not comparable with a cradle-to-gate production factor — ICE publishes both
 *  for timber, and picking the wrong one flips the sign of a component. */
export function isCarbonStorageVariant(lcaActivity: string | null | undefined): boolean {
  return (lcaActivity ?? "").includes("carbon_storage");
}
