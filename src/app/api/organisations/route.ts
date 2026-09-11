import { createOrganisation, listOrganisations, type NewOrganisation } from "@/db/organisations";

// The obligated economic operator a screening is prepared for. The
// new-assessment form is a client component, so it reads and writes the list
// through here rather than querying the database directly.

export async function GET() {
  try {
    const orgs = await listOrganisations();
    return Response.json({ organisations: orgs });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load organisations." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: NewOrganisation;
  try {
    body = (await request.json()) as NewOrganisation;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Legal name and country are the two fields every downstream artefact needs —
  // the report header, the passport declarant block and DoC element 2 all read
  // them — so they are required rather than defaulted.
  if (!body.legalName?.trim()) {
    return Response.json({ error: "A legal name is required." }, { status: 400 });
  }
  if (!/^[A-Za-z]{2}$/.test(body.country?.trim() ?? "")) {
    return Response.json({ error: "Country must be a two-letter ISO 3166-1 code." }, { status: 400 });
  }

  try {
    const id = await createOrganisation(body);
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create the organisation." },
      { status: 500 },
    );
  }
}
