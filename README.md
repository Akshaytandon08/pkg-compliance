# pkg-compliance

Packaging Compliance Intelligence — prototype. A qualification-screening engine for packaging compliance (EU + India): BOM + evidence in → qualification report, questionnaire auto-fill, screening-grade PCF, and signed passport page out.

Standalone Fitsol product (working codename `pkg-compliance`; product name TBD). Integrates with GreenAlign and Kyoto.

- [docs/BRIEF.md](docs/BRIEF.md) — approved build brief (source of truth; decisions settled)
- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) — living plan, sprint status, blockers
- [reference/](reference/) — golden-run and seed artefacts (pending)

**Guardrail:** this system performs qualification screening and evidence assembly only. It never issues a Declaration of Conformity or any certification.

## Development

Next.js 16 (App Router, TypeScript) + PostgreSQL via Drizzle ORM.

```bash
cp .env.example .env      # then fill in values
docker compose up -d      # local Postgres 16
npm install
npm run db:migrate        # apply corpus migrations
npm run dev
```

Postgres runs on host port **5433** (5432 is taken by `asset-directory-db` locally).

- `npm run check` — lint + language tripwire + typecheck + tests (run before committing)
- `npm test` — golden fixtures, verdict rule table, output-language guardrail; database tests skip when no DB is reachable
- `npm run db:generate` — generate a migration after editing `src/db/schema.ts`

Corpus (checkpoint) changes require regulatory-owner sign-off. This is enforced, not requested: checkpoints insert as `draft`, and only an approval record in `checkpoint_approvals` permits `in_force` — the evaluator refuses to produce a verdict from anything else. See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) and [docs/SCHEMA_DELTAS.md](docs/SCHEMA_DELTAS.md).

## Deployment (pilot)

Target: **Vercel + managed Postgres** (Vercel Postgres, Neon, or Supabase — any Postgres 16 URL). The actual deploy requires a Vercel account and a provisioned database; the repo is wired so that once those exist, deploying is configuration only.

**Environment variables** (set in the hosting dashboard):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Managed Postgres connection string (Postgres 16). |
| `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` | **Access gate.** When both are set, every route requires HTTP Basic Auth (`src/proxy.ts`) — client BOM data must not sit on an open URL. Leave unset only for local dev. **Exception:** the public passport tier `/passport/<token>` is deliberately ungated (see below). |
| `ANTHROPIC_API_KEY` | Reserved for the extraction pipeline (not yet used). |

**Migrations are wired into deploy:** the `vercel-build` script runs `drizzle-kit migrate && next build`, so the hosted DB is migrated on every deployment. (Set the platform Build Command to `npm run vercel-build` if it is not auto-detected.)

**Seed the demo pack against the hosted DB** (one-off, from a machine with the prod URL):

```bash
DATABASE_URL="<prod-postgres-url>" node scripts/seed-demo.ts
```

**The corpus approval CLIs stay local.** `corpus:review` / `:approve` / `:reject` are `scripts/*.ts` run by a human against a database — they are **not** web routes and are never exposed on the hosted surface. Approving/promoting a checkpoint or guidance row remains a local, human-run action.

**Public passport tier bypasses the access gate — by design.** `/passport/<token>` is the public disclosure layer (Stack C). The access-gate matcher in `src/proxy.ts` explicitly excludes `passport/`, so anyone with the link can view it without credentials. This is safe because the passport renders only the PUBLIC tier — pack name, material summary, verdict counts, corpus version and a footprint summary — never evidence, per-checkpoint detail, or anything from a draft/contested checkpoint, and it is addressed by an unguessable per-assessment token (not the assessment id). The passport **authoring** endpoint (`POST /api/assessments/[id]/passport`) is NOT excluded and stays gated.

**Hosted URL & access:** recorded in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) once deployed (URL TBD; access via the Basic Auth credentials above).
