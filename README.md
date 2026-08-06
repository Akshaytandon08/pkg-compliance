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

- `npm run check` — lint + forbidden-language guardrail + typecheck (run before committing)
- `npm run db:generate` — generate a migration after editing `src/db/schema.ts`
- Corpus (checkpoint) changes require regulatory-owner sign-off — see [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)
