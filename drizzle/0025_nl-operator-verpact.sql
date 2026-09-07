-- Consistency with the validated operator: the NL scheme operator is Stichting
-- Verpact (formerly Afvalfonds Verpakkingen). Correct the draft requirement_text
-- so it no longer names Afvalfonds alone. Draft row; approval unchanged.
UPDATE checkpoints SET
  requirement_text = 'Register with the Dutch packaging producer scheme (Stichting Verpact, formerly Afvalfonds Verpakkingen) and file packaging declarations; appoint an authorised representative where not established in the Netherlands. Filing cadence as prescribed nationally.'
  WHERE id = 'EU-MS-NL-epr-registration' AND version = 2;
