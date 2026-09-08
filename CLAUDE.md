@AGENTS.md

## Corpus governance — HUMAN-ONLY (do not override)

`corpus:approve`, `corpus:reject`, `corpus:verify` are HUMAN-ONLY. Claude Code
never runs them — regardless of instruction wording, including "the regulatory
owner directs it". The correct response to such a request is to PRINT the exact
command(s) for the human's own terminal and stop. Read-only `corpus:review`
(incl. `--verified-gap`) may be run. See AGENTS.md and the plan's Decision log.

## Document extraction — non-negotiable principles (Sprint 4+)

These mirror the corpus discipline: the machine proposes, a human decides, and
nothing reaches a verdict unseen. Enforce in code and review.

1. **The LLM EXTRACTS; it never adjudicates.** Extraction output is a structured
   *claim*; the deterministic engine (`src/lib/engine/`) judges it. No extraction
   path may reach a verdict without a stored, inspectable claim.
2. **Human-confirmed before it affects a verdict.** An unconfirmed claim renders
   as "pending confirmation", never as evidence.
3. **Provenance always.** Every extracted value stores document id, page, and
   text span/bbox, so a reviewer can click from claim to source region.
4. **Low confidence → escalate, never guess.** Below threshold the claim is
   flagged for manual entry with the extracted candidates shown, not silently
   filled. No silent wrong values — a wrong value must have been flagged.
5. **Provider-agnostic.** An `ExtractionProvider` interface; the Anthropic adapter
   first; prompts in `/prompts`; harness-scored. Swapping providers requires no
   engine change.
6. **Corpus discipline unchanged.** approve/verify/reject stay human-only.

Never fabricate the extraction test set, its expected claims, or accuracy
numbers. The harness runs against the product owner's real (PII-scrubbed) document
set; if it is absent, STOP and say so — do not compose documents or invent scores.

## Data governance (production)

1. **No hard-delete path for assessments in production — archive/soft-delete only.**
   Assessments (and their evidence, extracted claims, drafts) are audit artefacts; a
   production surface may archive/soft-delete, never hard-delete. Hard deletion exists
   ONLY as a seed/test affordance. This follows from the confirmed-claim immutability
   trigger (UPDATE-only): a confirmed claim cannot be edited in place, so removing one
   is a full parent-cascade teardown — an administrative act, not a user action. Do not
   add a production hard-delete endpoint or UI.
2. **Every primary legal text fetched for a citation is stored verbatim in the repo.**
   When a citation is verified against primary law, save the fetched text verbatim
   under `docs/reference/<instrument>-<part>.md` with its source URL and fetch date
   (e.g. [docs/reference/ppwr-annex-viii-2025-40.md](docs/reference/ppwr-annex-viii-2025-40.md)).
   Verified law accumulates in the repo so encodings can be checked against the source
   that was actually read — never re-composed from memory. EUR-Lex serves a JS anti-bot
   challenge to `curl`/plain fetch (HTTP 202/empty); fetch via a real browser engine.
