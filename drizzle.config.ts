import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl } from "./src/db/database-url.ts";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env yet — fine for schema-only commands like `generate`
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Same resolver as the runtime: on a Vercel preview build this migrates the
    // PREVIEW database, never production.
    url: resolveDatabaseUrl(),
  },
});
