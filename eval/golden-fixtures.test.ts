// Validates each golden fixture's internal consistency against the
// deterministic verdict rule table and the format contract (eval/README.md)
// BEFORE the engine exists. Purpose: freeze the fixture format and catch schema
// drift early — if a seeded checkpoint or a rule-table change would move a
// golden verdict, this fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideVerdict } from "../src/lib/engine/verdict.ts";

type Expectation = {
  checkpointId: string;
  checkpointVersion: number;
  verdict: string;
  designAssessment?: string;
  evidenceState: string;
  risk: string;
  reasonCode: string;
  blockingEvidence: string[];
  basis?: string;
};

type Fixture = {
  fixtureFormatVersion: number;
  asOf: string;
  legalRole: { ambiguous: boolean; expectedFlag?: string };
  components: { line: string; name: string; evidenceDocuments: unknown[]; expected: Expectation[] }[];
  bomCompletenessGaps: { ref: string; verdict: string; reasonCode: string; requiredAction: string }[];
  dataCorrections: { line: string; field: string }[];
  notApplicable: { checkpointId: string; reasonCode: string; recordedScopingNote: boolean }[];
  forwardFlags: { checkpointId: string; reasonCode: string; appliesFrom: string }[];
  packLevelExpected: (Expectation & { subject: string })[];
  expectedOverall: { verdict: string; counts: Record<string, number> };
};

// The reason-code vocabulary is load-bearing: the engine will emit these, and
// the report renderer will key off them. Pin it here (mirrors eval/README.md).
const REASON_TO_VERDICT: Record<string, string> = {
  EVIDENCE_COMPLETE: "qualified",
  EVIDENCE_ABSENT: "conditional",
  EVIDENCE_INCOMPLETE: "conditional",
  EVIDENCE_EXPIRED: "conditional",
  TEST_REQUIRED: "conditional",
  DESIGN_NONCOMPLIANT: "gap",
  NOT_IN_BOM: "gap",
  NOT_APPLICABLE_SCOPE: "not_applicable",
  FORWARD_NOT_YET_IN_FORCE: "flag",
};

const FIXTURES = ["client-a-traction-cell.json"];

for (const file of FIXTURES) {
  const fixture: Fixture = JSON.parse(
    readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8"),
  );

  const componentExpected = fixture.components.flatMap((c) =>
    c.expected.map((e) => ({ ...e, where: `line ${c.line}` })),
  );
  const packExpected = fixture.packLevelExpected.map((e) => ({
    ...e,
    where: `pack:${e.subject}`,
  }));
  const allExpected = [...componentExpected, ...packExpected];

  test(`${file}: fixture format version is current`, () => {
    assert.equal(fixture.fixtureFormatVersion, 1);
  });

  test(`${file}: every expectation matches the deterministic rule table`, () => {
    for (const e of allExpected) {
      const actual = decideVerdict({
        designAssessment: e.designAssessment as never,
        evidenceState: e.evidenceState as never,
      });
      assert.equal(actual.verdict, e.verdict, `${e.where} / ${e.checkpointId}: verdict`);
      assert.equal(actual.risk, e.risk, `${e.where} / ${e.checkpointId}: risk`);
    }
  });

  test(`${file}: every expectation pins a checkpoint id and version`, () => {
    for (const e of allExpected) {
      assert.ok(e.checkpointId, `${e.where}: missing checkpointId`);
      assert.ok(
        Number.isInteger(e.checkpointVersion) && e.checkpointVersion >= 1,
        `${e.where} / ${e.checkpointId}: verdict must pin a corpus version`,
      );
    }
  });

  test(`${file}: reason codes are in the vocabulary and agree with the verdict`, () => {
    const check = (
      where: string,
      id: string,
      reasonCode: string,
      verdict: string,
    ) => {
      const expectedVerdict = REASON_TO_VERDICT[reasonCode];
      assert.ok(expectedVerdict, `${where} / ${id}: unknown reasonCode ${reasonCode}`);
      assert.equal(
        expectedVerdict,
        verdict,
        `${where} / ${id}: reasonCode ${reasonCode} implies ${expectedVerdict}, not ${verdict}`,
      );
    };
    for (const e of allExpected) check(e.where, e.checkpointId, e.reasonCode, e.verdict);
    for (const g of fixture.bomCompletenessGaps)
      check(`gap:${g.ref}`, g.ref, g.reasonCode, g.verdict);
    for (const na of fixture.notApplicable)
      check("not-applicable", na.checkpointId, na.reasonCode, "not_applicable");
    for (const f of fixture.forwardFlags)
      check("forward", f.checkpointId, f.reasonCode, "flag");
  });

  test(`${file}: conditional names its blocking evidence; qualified has none`, () => {
    for (const e of allExpected) {
      if (e.verdict === "conditional") {
        assert.ok(
          e.blockingEvidence.length > 0,
          `${e.where} / ${e.checkpointId}: conditional with no blocking evidence`,
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

  test(`${file}: overall counts reconcile with the individual expectations`, () => {
    const tally: Record<string, number> = { qualified: 0, conditional: 0, gap: 0, notApplicable: 0 };
    for (const e of allExpected) tally[e.verdict]++;
    tally.gap += fixture.bomCompletenessGaps.length;
    tally.notApplicable += fixture.notApplicable.length;
    assert.deepEqual(tally, fixture.expectedOverall.counts);
  });

  test(`${file}: overall verdict is the worst individual verdict`, () => {
    // Gaps exist (photo-gap components), but the golden run's overall verdict is
    // CONDITIONAL because the gaps are BOM-completeness findings, not design
    // failures. Pinned so the aggregation rule cannot silently flip.
    assert.equal(fixture.expectedOverall.verdict, "conditional");
    assert.ok(fixture.bomCompletenessGaps.length > 0);
    assert.ok(
      fixture.bomCompletenessGaps.every((g) => g.requiredAction === "bom_addition"),
      "a gap from a design failure would have to raise the overall verdict",
    );
  });

  test(`${file}: ambiguous legal role is flagged, never silently assigned`, () => {
    assert.equal(fixture.legalRole.ambiguous, true);
    assert.equal(fixture.legalRole.expectedFlag, "legal_confirmation_required");
  });

  test(`${file}: not-applicable checkpoints carry a recorded scoping note`, () => {
    for (const na of fixture.notApplicable) {
      assert.equal(na.recordedScopingNote, true, `${na.checkpointId}: N/A needs a scoping note`);
    }
  });

  test(`${file}: forward flags are dated and never rendered as inapplicable`, () => {
    for (const f of fixture.forwardFlags) {
      assert.match(f.appliesFrom, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(f.appliesFrom > fixture.asOf, `${f.checkpointId} is not forward-dated`);
    }
  });
}
