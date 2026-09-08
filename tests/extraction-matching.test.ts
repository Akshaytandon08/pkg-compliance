// A5 — deterministic claim → checkpoint matching. A confirmed/extracted claim is
// proposed as a PENDING evidence attachment, judged by the same evaluator code
// real evidence is. Nothing is auto-confirmed; expiry and scope are honoured; a
// claim no checkpoint accepts yields no proposal. Pure — no DB, no LLM.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  proposeEvidenceAttachments,
  claimToNewEvidence,
  EVIDENCE_TYPE_BY_CLAIM,
  type MatchCheckpoint,
  type MatchComponent,
} from "../src/lib/extraction/matching.ts";
import type { ExtractedClaimDraft } from "../src/lib/extraction/types.ts";

const components: MatchComponent[] = [
  { id: 1, name: "Film wrap", material: "plastic" },
  { id: 2, name: "Outer box", material: "corrugated" },
];

// A component checkpoint that a supplier declaration closes.
const recycledCp: MatchCheckpoint = {
  id: "EU-recycled-content",
  subject: "component",
  requirement: { allOf: [{ anyOf: ["supplier_declaration"] }] },
};
// A checkpoint that only a test_report closes — a supplier declaration must NOT match it.
const testCp: MatchCheckpoint = {
  id: "EU-heavy-metals",
  subject: "component",
  requirement: { allOf: [{ anyOf: ["test_report"] }] },
};

function claim(over: Partial<ExtractedClaimDraft> = {}): ExtractedClaimDraft {
  return {
    claimType: "recycled_content",
    value: "40",
    unit: "%",
    confidence: 0.95,
    provenance: { page: 1 },
    ...over,
  };
}

test("a recycled-content claim scoped to a component proposes a pending attachment that closes the gap", () => {
  const proposals = proposeEvidenceAttachments({
    claims: [claim()],
    documentComponentId: 1,
    components,
    checkpoints: [recycledCp, testCp],
    existingDocuments: [],
    asOf: "2026-09-08",
  });
  assert.equal(proposals.length, 1);
  const p = proposals[0];
  assert.equal(p.status, "pending_confirmation"); // never auto-confirmed
  assert.equal(p.evidenceType, "supplier_declaration");
  assert.equal(p.componentId, 1);
  assert.equal(p.expired, false);
  // It closes the recycled-content checkpoint (absent -> complete) and does NOT
  // touch the test-report-only checkpoint.
  assert.deepEqual(p.checkpoints, [{ id: "EU-recycled-content", before: "absent", after: "complete" }]);
});

test("a claim no applicable checkpoint accepts yields NO proposal (no false positives)", () => {
  const proposals = proposeEvidenceAttachments({
    claims: [claim()], // supplier_declaration
    documentComponentId: 1,
    components,
    checkpoints: [testCp], // only accepts test_report
    existingDocuments: [],
    asOf: "2026-09-08",
  });
  assert.equal(proposals.length, 0);
});

test("an expired claim is flagged and surfaces as expired, not as closing the gap", () => {
  const proposals = proposeEvidenceAttachments({
    claims: [claim({ expiry: "2024-01-01" })],
    documentComponentId: 1,
    components,
    checkpoints: [recycledCp],
    existingDocuments: [],
    asOf: "2026-09-08",
  });
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].expired, true);
  // Absent -> expired (the evaluator sees a covering-but-expired document).
  assert.deepEqual(proposals[0].checkpoints, [
    { id: "EU-recycled-content", before: "absent", after: "expired" },
  ]);
});

test("a metadata-only claim (issuer) implies no evidence_type and no proposal", () => {
  assert.equal(EVIDENCE_TYPE_BY_CLAIM["issuer_identity"], undefined);
  const proposals = proposeEvidenceAttachments({
    claims: [claim({ claimType: "issuer_identity", value: "Acme Films Ltd" })],
    documentComponentId: 1,
    components,
    checkpoints: [recycledCp],
    existingDocuments: [],
    asOf: "2026-09-08",
  });
  assert.equal(proposals.length, 0);
});

test("claimToNewEvidence maps a claim to a scoped evidence row, or null for metadata", () => {
  const ev = claimToNewEvidence(
    { claimType: "recycled_content", parameter: "recycled_content", expiry: "2027-01-01" },
    { name: "Film wrap", material: "plastic" },
  );
  assert.equal(ev?.evidenceType, "supplier_declaration");
  assert.deepEqual(ev?.scopeComponents, ["Film wrap"]);
  assert.deepEqual(ev?.scopeMaterials, ["plastic"]);
  assert.equal(ev?.expiryDate, "2027-01-01");
  // A metadata claim carries no evidence_type → not evidence.
  assert.equal(
    claimToNewEvidence({ claimType: "issuer_identity", parameter: null, expiry: null }, { name: "x", material: "plastic" }),
    null,
  );
});

test("with no document component, scope is resolved by material mentioned in the claim", () => {
  const proposals = proposeEvidenceAttachments({
    claims: [claim({ scopeText: "recycled plastic film" })],
    documentComponentId: null,
    components,
    checkpoints: [recycledCp],
    existingDocuments: [],
    asOf: "2026-09-08",
  });
  // Matches the plastic component by material token, not the corrugated one.
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].componentId, 1);
});
