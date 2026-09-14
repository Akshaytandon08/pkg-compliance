// The mass field's plausibility check — the other half of the 1000× guard.
//
// `src/lib/factors/units.ts` stops a 1000× error arriving from the FACTOR side
// (BEIS publishes kg/tonne; storing that verbatim would have made a 900 g carton
// read 1,074 kg CO2e). This file stops the same error arriving from the MASS
// side, which opened up the moment the intake started asking for kilograms
// instead of grams: someone used to typing `900` for a 900 g carton now enters
// 900 kg, and the footprint is wrong by exactly the same factor, in exactly the
// same direction, on exactly the same customer-facing number.
//
// It WARNS; it never blocks. No data check can distinguish a deliberate 900 kg
// from a mistyped one, so the only honest thing to do is state the band the
// value falls outside and let the person who knows the pack decide. Refusing the
// value would make a genuinely heavy component unenterable; accepting it in
// silence is the failure this exists to prevent.
//
// The bands are PER MATERIAL, because "implausible" is not one number: 12 kg is
// an ordinary pallet and an absurd label, and a single global threshold either
// nags every pallet or lets every mistyped carton through. Each band spans the
// lightest and heaviest single component of that material a packaging BOM
// realistically carries — a 1 g kraft label to a 30 kg bulk case; a 0.2 g film
// window to a 30 kg drum; a 50 g wooden brace to a 70 kg crate; a 0.5 g staple
// to a 30 kg steel drum. They are deliberately wide: a warning that fires on
// ordinary data is a warning people learn to click past.

import { materialLabel } from "../report/labels.ts";

export interface MassBand {
  /** Lightest plausible single component of this material, in kilograms. */
  minKg: number;
  /** Heaviest plausible single component of this material, in kilograms. */
  maxKg: number;
}

const BANDS: Record<string, MassBand> = {
  corrugated: { minKg: 0.001, maxKg: 30 },
  plastic: { minKg: 0.0002, maxKg: 30 },
  wood_solid: { minKg: 0.05, maxKg: 70 },
  wood_processed: { minKg: 0.05, maxKg: 70 },
  metal: { minKg: 0.0005, maxKg: 30 },
};

/** The widest band of any material — used when no material has been chosen yet,
 *  so an unselected row cannot be warned about on a guess. */
const DEFAULT_BAND: MassBand = { minKg: 0.0002, maxKg: 70 };

export function massBand(material: string): MassBand {
  return BANDS[material] ?? DEFAULT_BAND;
}

/**
 * A non-blocking note about an entered mass, or null when it needs no comment.
 *
 * Pure — it takes the raw field string and the chosen material, so the rule can
 * be tested without the form. The caller decides how to show it; nothing here
 * gates submission.
 */
export function massPlausibilityWarning(raw: string, material: string): string | null {
  if (raw.trim() === "") return null;
  const kg = Number(raw);
  if (!Number.isFinite(kg) || kg <= 0) return null; // massError already speaks here

  const band = massBand(material);
  if (kg >= band.minKg && kg <= band.maxKg) return null;

  const what = materialLabel(material).toLowerCase();
  const range = `${format(band.minKg)}–${format(band.maxKg)} kg`;
  const side = kg > band.maxKg ? "heavy" : "light";
  // The gram reading is named explicitly on the heavy side, because that is the
  // slip this guard was built for and "did you mean 900 g?" is answerable at a
  // glance in a way that "check the unit" is not.
  const suggestion =
    kg > band.maxKg
      ? ` Masses are in kilograms — if you meant ${format(kg)} g, enter ${format(kg / 1000)}.`
      : " Masses are in kilograms, not grams.";
  return `${format(kg)} kg is ${side} for a ${what} component — these are usually ${range}.${suggestion}`;
}

/** Trim IEEE-754 tails without inventing precision the input did not have. */
function format(n: number): string {
  return String(Number(n.toPrecision(12)));
}
