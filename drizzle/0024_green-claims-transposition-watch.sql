-- Monitoring: the EU green-claims measure applies via national transposition,
-- which is a moving target — record it as a future_law_watch so it surfaces in
-- corpus:review alongside the IT (RENAP) and PL (PPWR/EPR reform) watch items.
-- Draft row; approval unchanged.
UPDATE checkpoints SET
  future_law_watch = 'national transposition status per Member State (Directive (EU) 2024/825)'
  WHERE id = 'EU-green-claims-substantiation' AND version = 2;
