// The eval harness's reason for existing: assert the ENGINE's verdicts against
// the golden fixtures. Skipped until the extraction + evaluation engine lands
// (Sprint 2). When it does, wiring is a one-line change — replace the throw in
// `evaluatePack` below with the real import and drop the skip.
//
// This is what makes "scaling the model must not silently change verdicts"
// enforceable: any drift from a golden verdict fails CI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ENGINE_PENDING = { skip: "engine lands in Sprint 2 (src/lib/engine/evaluate.ts)" };

const FIXTURES = ["client-a-traction-cell.json"];

type Expectation = {
  checkpointId: string;
  checkpointVersion: number;
  verdict: string;
  risk: string;
  reasonCode: string;
};
type Fixture = {
  pack: { id: string };
  asOf: string;
  assessment_context: {
    destination_member_states: string[];
    food_contact: boolean;
    persona: string;
    declared_reusable: boolean;
    legal_role_facts: Record<string, unknown>;
  };
  components: { line: string; expected: Expectation[] }[];
  packLevelExpected: (Expectation & { subject: string })[];
  expectedOverall: { verdict: string; counts: Record<string, number> };
};

// The shape the Sprint 2 engine must return. Written now so the skipped
// assertions below compile against the real contract, not a stub.
type CheckpointVerdict = { verdict: string; risk: string; reasonCode: string };
type PackResult = {
  forComponent: (line: string, checkpointId: string, version: number) => CheckpointVerdict;
  forSubject: (subject: string, checkpointId: string, version: number) => CheckpointVerdict;
  overall: { verdict: string; counts: Record<string, number> };
  caveats: { checkpointId: string; verdict?: undefined }[];
};

// Placeholder for the future engine entry point. Signature is the contract:
// (pack claims + evidence, corpus as-of a date) -> per-checkpoint verdicts.
function evaluatePack(fixture: Fixture): PackResult {
  throw new Error(`engine not implemented (pack ${fixture.pack.id})`);
}

for (const file of FIXTURES) {
  const fixture: Fixture = JSON.parse(
    readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8"),
  );

  test(`${file}: engine reproduces every component verdict`, ENGINE_PENDING, () => {
    const result = evaluatePack(fixture);
    for (const component of fixture.components) {
      for (const e of component.expected) {
        const actual = result.forComponent(component.line, e.checkpointId, e.checkpointVersion);
        assert.equal(actual.verdict, e.verdict);
        assert.equal(actual.risk, e.risk);
        assert.equal(actual.reasonCode, e.reasonCode);
      }
    }
  });

  test(`${file}: engine reproduces pack- and consignment-level verdicts`, ENGINE_PENDING, () => {
    const result = evaluatePack(fixture);
    for (const e of fixture.packLevelExpected) {
      const actual = result.forSubject(e.subject, e.checkpointId, e.checkpointVersion);
      assert.equal(actual.verdict, e.verdict);
      assert.equal(actual.reasonCode, e.reasonCode);
    }
  });

  test(`${file}: engine reproduces the overall verdict and counts`, ENGINE_PENDING, () => {
    const result = evaluatePack(fixture);
    assert.equal(result.overall.verdict, fixture.expectedOverall.verdict);
    assert.deepEqual(result.overall.counts, fixture.expectedOverall.counts);
  });

  test(`${file}: engine never emits a verdict for a draft/contested checkpoint`, ENGINE_PENDING, () => {
    // Ties the eval harness to the approval gate: only in_force checkpoints
    // yield verdicts; draft/contested render as caveats (evaluability.ts).
    const result = evaluatePack(fixture);
    assert.ok(result.caveats.every((c: { verdict?: string }) => c.verdict === undefined));
  });

  test(`${file}: applies_when with missing context yields a CONTEXT_REQUIRED caveat`, ENGINE_PENDING, () => {
    // Evaluate the same pack with destination_member_states stripped: the
    // producer-registration checkpoint (applies_when destination present) must
    // become a caveat/CONTEXT_REQUIRED — never a silent pass, never a gap.
    const stripped = {
      ...fixture,
      assessment_context: { ...fixture.assessment_context, destination_member_states: [] },
    };
    const result = evaluatePack(stripped);
    const caveat = result.caveats.find((c) => c.checkpointId === "EU-EPR-producer-registration");
    assert.ok(caveat, "producer-registration must be a caveat when destination is unknown");
    assert.equal(caveat.verdict, undefined, "a caveat is not a verdict");
  });
}
