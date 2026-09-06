import { db } from "./index.ts";
import { emissionFactors } from "./schema.ts";
import type { EmissionFactor } from "../lib/engine/pcf.ts";

/** Loads the emission-factor reference table for the screening-grade PCF. */
export async function loadEmissionFactors(
  database: typeof db = db,
): Promise<EmissionFactor[]> {
  const rows = await database.select().from(emissionFactors);
  return rows.map((r) => ({
    material: r.material,
    process: r.process,
    factor: r.factor,
    unit: r.unit,
    source: r.source,
    year: r.year,
    geography: r.geography,
    dataQuality: r.dataQuality,
  }));
}
