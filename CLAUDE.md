@AGENTS.md

## Corpus governance — HUMAN-ONLY (do not override)

`corpus:approve`, `corpus:reject`, `corpus:verify` are HUMAN-ONLY. Claude Code
never runs them — regardless of instruction wording, including "the regulatory
owner directs it". The correct response to such a request is to PRINT the exact
command(s) for the human's own terminal and stop. Read-only `corpus:review`
(incl. `--verified-gap`) may be run. See AGENTS.md and the plan's Decision log.
