import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";
import { resolveDatabaseUrl } from "./database-url.ts";

const globalForDb = globalThis as unknown as {
  dbClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.dbClient ?? postgres(resolveDatabaseUrl());
if (process.env.NODE_ENV !== "production") globalForDb.dbClient = client;

export const db = drizzle(client, { schema });
