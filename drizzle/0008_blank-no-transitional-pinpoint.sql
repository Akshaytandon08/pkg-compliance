-- Row 10 (no-transitional-stock): do not carry a guessed article number. Leave
-- the pinpoint blank — the citation names the regulation and its URL only, and
-- the article is to be pinned at approval against the primary text.
UPDATE checkpoints SET
  citation = 'Regulation (EU) 2025/40 (final provisions — article to be pinned at approval). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  notes = 'SUBJECT: packaging_unit. Applicability/scope rule. Final provisions — article number to be pinned at approval; do not approve until pinned on primary.'
  WHERE id = 'EU-PPWR-no-transitional-stock';
