// Validates the golden dataset against the deterministic rule table BEFORE the
// engine exists. Purpose is to freeze the fixture format and catch schema drift
// early: if a seeded checkpoint or a rule-table change would move an Exide
// verdict, this fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideVerdict } from "../src/lib/engine/verdict.ts";

type Expectation = {
  checkpointId: string;
  verdict: string;
  designAssessment?: string;
  evidenceState: string;
  risk: string;
  blockingEvidence: string[];
  basis?: string;
};

type Fixture = {
  fixtureFormatVersion: number;
  asOf: string;
  legalRole: { ambiguous: boolean; expectedFlag?: string };
  components: {
    line: string;
    name: string;
    expected: Expectation[];
  }[];
  bomCompletenessGaps: { ref: string; verdict: string; requiredAction: string }[];
  dataCorrections: { line: string; field: string }[];
  notApplicable: { checkpointId: string; recordedScopingNote: boolean }[];
  forwardFlags: { checkpointId: string; appliesFrom: string }[];
  packLevelExpected: (Expectation & { subject: string })[];
  expectedOverall: {
    verdict: string;
    counts: Record<string, number>;
  };
};

const fixture: Fixture = JSON.parse(
  readFileSync(new URL("./fixtures/exide-traction-cell.json", import.meta.url), "utf8"),
);

test("fixture format version is current", () => {
  assert.equal(fixture.fixtureFormatVersion, 1);
});

test("every component expectation matches the deterministic rule table", () => {
  for (const component of fixture.components) {
    for (const e of component.expected) {
      const actual = decideVerdict({
        designAssessment: e.designAssessment as never,
        evidenceState: e.evidenceState as never,
      });
      assert.equal(
        actual.verdict,
        e.verdict,
        `line ${component.line} / ${e.checkpointId}: expected verdict ${e.verdict}, rule table gives ${actual.verdict}`,
      );
      assert.equal(
        actual.risk,
        e.risk,
        `line ${component.line} / ${e.checkpointId}: expected risk ${e.risk}, rule table gives ${actual.risk}`,
      );
    }
  }
});

test("conditional verdicts always name the evidence that would close them", () => {
  const all = [
    ...fixture.components.flatMap((c) =>
      c.expected.map((e) => ({ ...e, where: `line ${c.line}` })),
    ),
    ...fixture.packLevelExpected.map((e) => ({ ...e, where: "pack level" })),
  ];
  for (const e of all) {
    if (e.verdict === "conditional") {
      assert.ok(
        e.blockingEvidence.length > 0,
        `${e.where} / ${e.checkpointId}: conditional with no blocking evidence is not actionable`,
      );
    }
    if (e.verdict === "qualified") {
      assert.equal(
        e.blockingEvidence.length,
        0,
        `${e.where} / ${e.checkpointId}: qualified must have no outstanding evidence`,
      );
    }
  }
});

test("overall counts reconcile with the individual expectations", () => {
  const tally: Record<string, number> = {
    qualified: 0,
    conditional: 0,
    gap: 0,
    notApplicable: 0,
  };
  for (const c of fixture.components) {
    for (const e of c.expected) tally[e.verdict]++;
  }
  for (const e of fixture.packLevelExpected) tally[e.verdict]++;
  tally.gap += fixture.bomCompletenessGaps.length;
  tally.notApplicable += fixture.notApplicable.length;

  assert.deepEqual(tally, fixture.expectedOverall.counts);
});

test("overall verdict is the worst individual verdict", () => {
  // Gaps exist (photo-gap components), but the manual run's overall verdict is
  // CONDITIONAL because the gaps are BOM-completeness findings, not design
  // failures. Encoding that here so the aggregation rule cannot silently flip.
  assert.equal(fixture.expectedOverall.verdict, "conditional");
  assert.ok(fixture.bomCompletenessGaps.length > 0);
  assert.ok(
    fixture.bomCompletenessGaps.every((g) => g.requiredAction === "bom_addition"),
    "a gap from a design failure would have to raise the overall verdict",
  );
});

test("ambiguous legal role is flagged, never silently assigned", () => {
  assert.equal(fixture.legalRole.ambiguous, true);
  assert.equal(fixture.legalRole.expectedFlag, "legal_confirmation_required");
});

test("not-applicable checkpoints still carry a recorded scoping note", () => {
  for (const na of fixture.notApplicable) {
    assert.equal(
      na.recordedScopingNote,
      true,
      `${na.checkpointId}: N/A is an evidence obligation, not an omission`,
    );
  }
});

test("forward flags are dated and never rendered as inapplicable", () => {
  for (const f of fixture.forwardFlags) {
    assert.match(f.appliesFrom, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(f.appliesFrom > fixture.asOf, `${f.checkpointId} is not forward-dated`);
  }
});
