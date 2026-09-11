import { asc, eq } from "drizzle-orm";
import { db } from "./index.ts";
import { organisations, orgRegistrations, type OrganisationRow, type OrgRegistrationRow } from "./schema.ts";

// Read/write for the obligated economic operator a screening is prepared for.
// Deliberately thin: a screening tool does not need a CRM, and every field here
// has to earn its place on a report, a passport or a declaration.

export type OrganisationWithRegistrations = OrganisationRow & {
  registrations: OrgRegistrationRow[];
};

export async function listOrganisations(): Promise<OrganisationRow[]> {
  return db.select().from(organisations).orderBy(asc(organisations.legalName));
}

export async function getOrganisation(id: number): Promise<OrganisationWithRegistrations | null> {
  const [org] = await db.select().from(organisations).where(eq(organisations.id, id));
  if (!org) return null;
  const registrations = await db
    .select()
    .from(orgRegistrations)
    .where(eq(orgRegistrations.organisationId, id))
    .orderBy(asc(orgRegistrations.jurisdiction));
  return { ...org, registrations };
}

export interface NewOrganisation {
  legalName: string;
  tradingName?: string | null;
  country: string;
  registeredAddress?: string | null;
  primaryContact?: string | null;
  roleDefault?: string | null;
  demo?: boolean;
  registrations?: {
    scheme: string;
    registerName?: string | null;
    registrationNumber: string;
    jurisdiction: string;
    validFrom?: string | null;
    validTo?: string | null;
  }[];
}

export async function createOrganisation(input: NewOrganisation): Promise<number> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(organisations)
      .values({
        legalName: input.legalName.trim(),
        tradingName: input.tradingName?.trim() || null,
        country: input.country.trim().toUpperCase(),
        registeredAddress: input.registeredAddress?.trim() || null,
        primaryContact: input.primaryContact?.trim() || null,
        roleDefault: input.roleDefault ?? null,
        demo: input.demo ?? false,
      })
      .returning({ id: organisations.id });
    for (const r of input.registrations ?? []) {
      await tx.insert(orgRegistrations).values({
        organisationId: row.id,
        scheme: r.scheme,
        registerName: r.registerName ?? null,
        registrationNumber: r.registrationNumber,
        jurisdiction: r.jurisdiction.toUpperCase(),
        validFrom: r.validFrom ?? null,
        validTo: r.validTo ?? null,
      });
    }
    return row.id;
  });
}
