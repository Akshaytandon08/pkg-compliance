// Shared helpers for the corpus review/approve/reject CLIs. These are the
// regulatory owner's working surface over the draft queue.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema.ts";
import type { EvidenceRequirement, Threshold } from "../src/db/schema.ts";

export function connect() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // DATABASE_URL may still be set in the environment
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (copy .env.example to .env, then `docker compose up -d`).");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema });
  return { sql, db };
}

export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export function requireString(
  args: Record<string, string | boolean>,
  key: string,
): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    console.error(`Missing required --${key}`);
    process.exit(1);
  }
  return value;
}

// Approval must cite primary law — enforced structurally on the source URL's
// host. Extend via CORPUS_PRIMARY_SOURCE_DOMAINS (comma-separated).
const DEFAULT_PRIMARY_DOMAINS = [
  "eur-lex.europa.eu",
  "egazette.gov.in",
  "egazette.nic.in",
  "cpcb.nic.in",
  "cpcb.gov.in", // CPCB EPR portal (eprplastic.cpcb.gov.in)
  "moef.gov.in", // India Ministry of Environment, Forest and Climate Change
  // National legislative gazettes/codes — the primary citation for the Batch 2
  // EU Member-State layer (validation report).
  "legifrance.gouv.fr", // France
  "gesetze-im-internet.de", // Germany
  "boe.es", // Spain — Boletín Oficial del Estado
  "gazzettaufficiale.it", // Italy — Gazzetta Ufficiale
  "wetten.overheid.nl", // Netherlands — consolidated legislation
  "officielebekendmakingen.nl", // Netherlands — official publications
  "isap.sejm.gov.pl", // Poland — Internetowy System Aktów Prawnych
  // IPPC/FAO — primary source for ISPM standards (multi-regime checkpoints).
  "ippc.int",
  "fao.org",
];

// Official register / PRO / guidance domains. These CORROBORATE a checkpoint but
// are NOT legislation, so they may only ever be `source_corroborating` — never
// the primary `citation`. Enforced by tests/db/citation-domains.
const CORROBORATING_ONLY_DOMAINS = [
  "verpackungsregister.org", // DE — LUCID/ZSVR
  "ademe.fr", // FR — ADEME/SYDEREP
  "miteco.gob.es", // ES — MITECO/RPP
  "renap.gov.it", // IT — RENAP
  "verpact.nl", // NL — Stichting Verpact
  "bdo.mos.gov.pl", // PL — BDO
];

const hostMatches = (url: string, domains: string[]): boolean => {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
};

export function primaryDomains(): string[] {
  const extra = (process.env.CORPUS_PRIMARY_SOURCE_DOMAINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...DEFAULT_PRIMARY_DOMAINS, ...extra];
}

export function isPrimarySourceUrl(url: string): boolean {
  return hostMatches(url, primaryDomains());
}

/** A corroborating-only host (official register/PRO/guidance) — never a citation. */
export function isCorroboratingOnlyUrl(url: string): boolean {
  return hostMatches(url, CORROBORATING_ONLY_DOMAINS);
}

// --- Human-readable renderers for the review pass -------------------------

export function renderThresholds(thresholds: Threshold[] | null): string {
  if (!thresholds || thresholds.length === 0) return "—";
  return thresholds
    .map((t) => {
      const base = `${t.parameter} ${t.operator} ${t.value} ${t.unit}`;
      return t.applies_when ? `${base} (${t.applies_when})` : base;
    })
    .join("; ");
}

export function renderCnf(req: EvidenceRequirement | null): string {
  if (!req || !Array.isArray(req.allOf) || req.allOf.length === 0) return "—";
  const clauses = req.allOf.map((c) => c.anyOf.join(" OR "));
  return clauses.length > 1 ? clauses.map((c) => `(${c})`).join(" AND ") : clauses[0];
}

export function renderAppliesWhen(aw: Record<string, unknown> | null): string {
  if (!aw || Object.keys(aw).length === 0) return "always";
  return Object.entries(aw)
    .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
    .join("; ");
}

// A citation carries the pinpoint and the source URL in one string. Split them
// for display: pinpoint without the trailing URL, plus the URL on its own.
export function splitCitation(citation: string): { pinpoint: string; url: string } {
  const match = citation.match(/https?:\/\/\S+/);
  const url = match ? match[0] : "";
  const pinpoint = citation.replace(/https?:\/\/\S+/, "").replace(/\.?\s*$/, "").trim();
  return { pinpoint, url };
}

export function oneLiner(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
