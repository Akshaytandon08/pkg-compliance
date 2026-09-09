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

### Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to `main` and every pull request: `npm ci` → **from-zero migration chain** against a Postgres 16 service container (`npm run db:migrate` on an empty DB — a broken or out-of-order migration fails here) → `npm run check` (with the DB reachable, so the DB-integration tests run) → `next build`. It never invokes corpus approval tooling.

**Require the check on `main` (owner, GitHub UI — one-time):**
`GitHub repo → Settings → Branches → Branch protection rules → Add branch protection rule` → Branch name pattern `main` → tick **Require status checks to pass before merging** (and optionally *Require branches to be up to date before merging*) → in the status-checks search box add **`build-test`** (the CI job) → **Create / Save changes**. On newer GitHub the equivalent lives under `Settings → Rules → Rulesets`. This setting can only be applied by a repository admin in the UI; it is not something the repo can enable for itself.

Corpus (checkpoint) changes require regulatory-owner sign-off. This is enforced, not requested: checkpoints insert as `draft`, and only an approval record in `checkpoint_approvals` permits `in_force` — the evaluator refuses to produce a verdict from anything else. Document templates (e.g. the PPWR Annex VIII EU declaration-of-conformity structure, `doc_templates`) follow the same gate: seeded `draft`, promoted to `approved` only by a human via `corpus:approve --doc-template`, and the draft generator refuses any template that is not approved. See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) and [docs/SCHEMA_DELTAS.md](docs/SCHEMA_DELTAS.md).

**Document exports are `.docx` + a PDF preview; markdown is internal only.** Every user-facing document export — the DRAFT EU declaration of conformity and the supplier-declaration / lab-test request templates — is generated directly from structured data via the `docx` library using controlled templates (`src/lib/doc-export/`), with a PDF rendering (pdfkit) for in-browser preview, and plain-language filenames (never internal ids). Markdown exists only as an internal preview/diff representation. The DoC feature **drafts; it never issues** — no system state records a declaration as "issued", the output carries a "DRAFT — for signature by the manufacturer" watermark, and the signed document, uploaded back, is stored as `conformity_declaration` evidence. The **passport stays web-only** (a page reached by QR, not a document).

## UI, brand & navigation

Light-first Fitsol theme: brand tokens (green/teal/neutral scales, semantic colours, surfaces) are CSS variables mapped to Tailwind utilities in [src/app/globals.css](src/app/globals.css); DM Sans for UI/body; one `StatusChip` component for every verdict/tag; Lucide icons only. The gated app renders in an `(app)` route group (header + nav); the **public** passport (`/passport/<token>`) renders on the bare root layout with no app chrome.

**Brand logo drop-in.** The official Fitsol SVGs are not bundled. Drop them into [`public/brand/`](public/brand/README.md) with the exact names `fitsol-logo-full-colour.svg`, `fitsol-logo-white.svg`, `fitsol-logomark.svg`. Until they exist a text wordmark is shown ([`src/app/_components/Wordmark.tsx`](src/app/_components/Wordmark.tsx)) and the logo is never drawn or approximated — the component comments show the one-line swap to `<img>`.

**Routes.** `/` assessments list · `/assessments/new` intake · `/assessments/[id]/report` screening report · `/corpus` corpus review (all gated) · `/passport/[token]` **public** passport (ungated, reached by the QR/link on a report).

## Deployment (pilot)

Target: **Vercel + managed Postgres** (Vercel Postgres, Neon, or Supabase — any Postgres 16 URL). The actual deploy requires a Vercel account and a provisioned database; the repo is wired so that once those exist, deploying is configuration only.

**Environment variables** (set in the hosting dashboard):

| Var | Vercel scope | Purpose |
|---|---|---|
| `DATABASE_URL` | Production (+ Development) | Managed Postgres connection string (Postgres 16) — the **production** database. |
| `PREVIEW_DATABASE_URL` | **Preview** | A **separate** Postgres 16 database for preview deployments. When `VERCEL_ENV=preview` (set automatically by Vercel), both migrations (`vercel-build`) and runtime use this instead of `DATABASE_URL`, so previews never read or migrate production (`src/db/database-url.ts`). If unset on a preview, the app warns and falls back to `DATABASE_URL` — set this to keep previews isolated. |
| `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` | Production + Preview | **Access gate.** When both are set, every route requires HTTP Basic Auth (`src/proxy.ts`) — client BOM data must not sit on an open URL. Leave unset only for local dev. **Exception:** the public passport tier `/passport/<token>` is deliberately ungated (see below). |
| `BLOB_READ_WRITE_TOKEN` | Production + Preview | **Object storage (required in production).** Generated DoC drafts and uploaded evidence documents are written through a storage adapter (`src/lib/storage/`). Vercel's serverless filesystem is **read-only**, so the local-FS adapter cannot write there — the app **refuses** local-FS when `VERCEL_ENV=production` and selects the **Vercel Blob** adapter (private access) whenever this token is present. Create a Blob store in **Vercel → Storage → Blob**; the token is injected as this env var automatically. Without it, "Generate draft" and evidence upload fail (the post-deploy smoke's storage self-test goes red). |
| `EVIDENCE_STORAGE_BACKEND` | (optional) | Force the adapter: `local` or `blob`. Unset = auto (Blob when `BLOB_READ_WRITE_TOKEN` is present, else local). `local` in production is refused. |
| `ANTHROPIC_API_KEY` | Production + Preview | Extraction pipeline (Claude API). Never logged. |

**Env-var mapping (Vercel → Settings → Environment Variables):** add `DATABASE_URL` scoped to *Production* (and *Development*), and `PREVIEW_DATABASE_URL` scoped to *Preview*. `VERCEL_ENV` is provided by Vercel automatically — no need to set it.

**Post-deploy smoke.** [`.github/workflows/deploy-smoke.yml`](.github/workflows/deploy-smoke.yml) runs on a successful **Production** `deployment_status` and hits `/api/health?storage=1` (`scripts/smoke.ts` / `npm run smoke -- <origin>`), failing on anything but `{status:"ok",database:"connected",storage:"ok"}`. The `?storage=1` flag makes the app run a **storage round-trip self-test** (write → read → delete a throwaway object), so a deploy where document storage cannot write — local-FS refused in production, or `BLOB_READ_WRITE_TOKEN` missing — fails smoke here rather than surfacing as "Generation failed" on a user's first click. It probes the **stable production alias only**: set the repo variable **`PRODUCTION_URL`** (`Settings → Secrets and variables → Actions → Variables`) to the alias (e.g. `https://pkg-compliance.vercel.app`); if it is unset the job **fails loudly** rather than fall back to the deployment-hash URL from the `deployment_status` payload — those hosts sit behind Vercel *Standard Protection* and return HTTP 401 "Protected deployment", so smoking one is meaningless. `scripts/smoke.ts` additionally **refuses** any `*.vercel.app` deployment-hash host as a recurrence guard. The app makes this reachable by bypassing Basic Auth for **exactly** `/api/health` (it returns only `{status, database}` — no user data; every other `/api` route stays gated), so no protection toggle or bypass token is needed for the alias.

**Migrations are wired into deploy:** the `vercel-build` script runs `drizzle-kit migrate && next build`, so the hosted DB is migrated on every deployment. (Set the platform Build Command to `npm run vercel-build` if it is not auto-detected.)

**Seed the demo pack against the hosted DB** (one-off, from a machine with the prod URL):

```bash
DATABASE_URL="<prod-postgres-url>" node scripts/seed-demo.ts
```

**The corpus approval CLIs stay local.** `corpus:review` / `:approve` / `:reject` are `scripts/*.ts` run by a human against a database — they are **not** web routes and are never exposed on the hosted surface. Approving/promoting a checkpoint or guidance row remains a local, human-run action.

**Public passport tier bypasses the access gate — by design.** `/passport/<token>` is the public disclosure layer (Stack C). The access-gate matcher in `src/proxy.ts` explicitly excludes `passport/`, so anyone with the link can view it without credentials. This is safe because the passport renders only the PUBLIC tier — pack name, material summary, verdict counts, corpus version and a footprint summary — never evidence, per-checkpoint detail, or anything from a draft/contested checkpoint, and it is addressed by an unguessable per-assessment token (not the assessment id). The passport **authoring** endpoint (`POST /api/assessments/[id]/passport`) is NOT excluded and stays gated.

**Hosted URL & access:** recorded in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) once deployed (URL TBD; access via the Basic Auth credentials above).
