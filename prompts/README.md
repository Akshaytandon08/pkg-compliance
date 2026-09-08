# Prompts

Structured-output extraction prompts for the Claude API pipeline (Sprint 4).
Prompts live here — in the repo, versioned — and are harness-scored against the
real-document set. Model or prompt changes must not silently change verdicts.

**The LLM extracts; it never adjudicates.** Pass/fail is deterministic rule
evaluation only. Every extracted value is a structured *claim* with provenance
(document id, page, span/bbox); the deterministic engine judges it, and a human
confirms it before it affects a verdict. See [CLAUDE.md](../CLAUDE.md) →
"Document extraction — non-negotiable principles".

## Model policy (extraction)

Verified against the current Claude API reference (not training memory) on
2026-09-07:

| Role | Model | Model ID | Input $/1M | Output $/1M | Context |
|---|---|---|---|---|---|
| **Default extractor** | Claude Sonnet 5 | `claude-sonnet-5` | $2.00 | $10.00 | 1M |
| **Escalation only** | Claude Opus 5 | `claude-opus-5` | $5.00 | $25.00 | 1M |

- **Default: `claude-sonnet-5`** — the cost/accuracy point for routine documents.
- **Escalation: `claude-opus-5`** — triggered ONLY when the Sonnet run returns
  below-threshold confidence or a malformed structured output; never the default.
- **Structured output** is provider-native: `output_config: { format: {…} }` on
  `messages.create()` (the old `output_format` is deprecated) / `messages.parse()`
  for schema validation; `strict: true` on tool defs for schema-valid args. PDF via
  base64 `document` blocks; scans via image/vision blocks when there is no text
  layer. **Citations** (`citations: { enabled: true }`) return page/char locations
  — used for claim provenance.
- **Harness runs BOTH models** over the full 20-document set and reports, per
  model: field accuracy, usable rate, silent-error count, refusal count, median
  latency, cost per document. **The default is chosen by the numbers**, not by this
  policy — if Sonnet meets ≥90% with zero silent errors it stays default;
  otherwise report before switching.
- **`model` and `prompt_version` are pinned per `extraction_run`** (schema). A
  model or prompt change re-runs the harness before it ships.
- Verify current model strings, structured-output support and pricing against the
  Claude API reference at build time — do not rely on training-data memory.

## Prompt versioning

Each prompt file carries a `version` and a changelog. Bumping a version re-runs
the harness (both models) and records the scores before it ships.
