// The mass plausibility band at intake. This is the second half of the 1000×
// guard: `tests/factor-units.test.ts` pins the factor side, this pins the mass
// side. The case that matters is the one the unit change created — a 900 g
// carton typed as `900` now that the field asks for kilograms.
//
// Pure — no DB, no form — so it runs in npm run check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { massPlausibilityWarning, massBand } from "../src/lib/intake/mass.ts";
import { BOM_MATERIALS } from "../src/lib/vocab.ts";

test("900 warns and 0.9 does not — the carton that motivated this guard", () => {
  const typo = massPlausibilityWarning("900", "corrugated");
  assert.ok(typo, "900 kg for a corrugated component must be questioned");
  assert.match(typo, /900 kg is heavy/);
  assert.match(typo, /0\.001–30 kg/, "the band the value falls outside is stated");
  assert.match(typo, /if you meant 900 g, enter 0\.9/, "the gram reading is named, not implied");

  assert.equal(massPlausibilityWarning("0.9", "corrugated"), null, "0.9 kg is an ordinary carton");
});

test("the band is per material — the same mass passes as wood and is questioned as board", () => {
  // 60 kg is a heavy crate and an impossible carton. One global threshold would
  // have to nag the crate or wave the carton through; the per-material band does
  // neither.
  assert.equal(massPlausibilityWarning("60", "wood_solid"), null, "a 60 kg crate is ordinary");
  const asBoard = massPlausibilityWarning("60", "corrugated");
  assert.ok(asBoard, "60 kg of corrugated is outside the corrugated band");
  assert.match(asBoard, /corrugated board component/, "the material is named in its own words");
});

test("the light side warns too, and does not offer a gram reading", () => {
  const w = massPlausibilityWarning("0.0001", "corrugated");
  assert.ok(w);
  assert.match(w, /is light for a corrugated board component/);
  assert.match(w, /not grams/);
  assert.doesNotMatch(w, /if you meant/, "dividing by 1000 cannot rescue a value already too small");
});

test("blank, non-numeric and non-positive masses stay silent — massError speaks there", () => {
  for (const raw of ["", "   ", "abc", "0", "-1"]) {
    assert.equal(massPlausibilityWarning(raw, "corrugated"), null, `"${raw}" must not produce a plausibility warning`);
  }
});

test("a component with no material chosen is warned only on the widest band", () => {
  // Guessing a band from an unselected material would nag ordinary data.
  assert.equal(massPlausibilityWarning("12", ""), null);
  assert.ok(massPlausibilityWarning("900", ""), "a 1000× slip is still outside every band");
});

test("every BOM material has a band, and every band is ordered and positive", () => {
  for (const m of BOM_MATERIALS) {
    const band = massBand(m);
    assert.ok(band.minKg > 0, `${m}: a mass band must start above zero`);
    assert.ok(band.maxKg > band.minKg, `${m}: band is inverted`);
  }
});

test("the guard's limit, stated rather than papered over", () => {
  // A band wide enough to cover a 1 g label AND a 30 kg bulk case spans far more
  // than 1000×, so a slip that lands inside it cannot be detected: a 1 g label
  // typed as `1` is 1 kg, which is an ordinary carton. This is not a defect to
  // be fixed by narrowing the band — a warning that fires on real cartons is
  // worse than one that misses a label. It is the reason the field states its
  // unit three times instead of relying on this check alone.
  assert.equal(massPlausibilityWarning("1", "corrugated"), null);
  // What the guard does promise: every slip large enough to change the pack
  // total by orders of magnitude is questioned.
  assert.ok(massPlausibilityWarning("900", "corrugated"));
  assert.ok(massPlausibilityWarning("12000", "wood_solid"));
});
