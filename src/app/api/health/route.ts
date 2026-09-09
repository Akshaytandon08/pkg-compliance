import { sql } from "drizzle-orm";
import { db } from "@/db";
import { storageSelfTest } from "@/lib/storage";

// Health probe. Always checks the database. With ?storage=1 it also runs a
// storage round-trip self-test (Part 0d) — the post-deploy smoke uses that so a
// deploy where document storage cannot write (local-FS refused in prod, or a
// missing Blob token) fails loudly instead of surfacing as "Generation failed"
// on the first user click. Plain /api/health stays cheap (no storage write).
export async function GET(request: Request) {
  const wantStorage = new URL(request.url).searchParams.get("storage") === "1";

  try {
    await db.execute(sql`select 1`);
  } catch {
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }

  if (!wantStorage) {
    return Response.json({ status: "ok", database: "connected" });
  }

  const s = await storageSelfTest();
  if (s.ok) {
    return Response.json({ status: "ok", database: "connected", storage: "ok", storageBackend: s.backend });
  }
  return Response.json(
    { status: "degraded", database: "connected", storage: "error", storageBackend: s.backend, storageError: s.error },
    { status: 503 },
  );
}
