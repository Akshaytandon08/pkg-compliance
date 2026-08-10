// Validates each golden fixture's internal consistency against the
// deterministic verdict rule table and the format contract (eval/README.md)
// BEFORE the engine exists. Purpose: freeze the fixture format and catch schema
// drift early — if a seeded checkpoint or a rule-table change would move a
// golden verdict, this fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideVerdict } from "../src/lib/engine/verdict.ts";
import { EVIDENCE_TYPES } from "../src/db/schema.ts";

const EVIDENCE_TYPE_SET = new Set<string>(EVIDENCE_TYPES);

type EvidenceRequirement = { allOf: { anyOf: string[] }[] };

type Expectation = {
  checkpointId: string;
  checkpointVersion: number;
  verdict: string;
  designAssessment?: string;
  evidenceState: string;
  risk: string;
  reasonCode: string;
  evidenceRequirements: EvidenceRequirement;
  scopeMismatch?: { documentId: string; coversComponent: boolean; reason: string };
  basis?: string;
};

type AssessmentContext = {
  destination_member_states: string[];
  food_contact: boolean;
  persona: string;
  declared_reusable: boolean;
  legal_role_facts: Record<string, unknown>;
};

type Fixture = {
  fixtureFormatVersion: number;
  asOf: string;
  assessment_context: AssessmentContext;
  legalRole: { ambiguous: boolean; expectedFlag?: string };
  components: { line: string; name: string; evidenceDocuments: unknown[]; expected: Expectation[] }[];
  bomCompletenessGaps: {
    ref: string;
    verdict: string;
    reasonCode: string;
    requiredAction: string;
    evidenceRequirements: EvidenceRequirement;
  }[];
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
  CONTEXT_REQUIRED: "caveat",
};

const VERDICT_SEVERITY: Record<string, number> = { qualified: 1, conditional: 2, gap: 3 };

// Asserts a value is well-formed CNF: allOf of anyOf, exactly one nesting level,
// every leaf a known evidence type. Resolves eval-format gap #1.
function assertCnf(where: string, req: EvidenceRequirement) {
  assert.ok(req && Array.isArray(req.allOf), `${where}: evidenceRequirements.allOf must be an array`);
  for (const clause of req.allOf) {
    assert.ok(
      clause && Array.isArray(clause.anyOf) && clause.anyOf.length > 0,
      `${where}: every allOf clause needs a non-empty anyOf`,
    );
    for (const leaf of clause.anyOf) {
      assert.equal(typeof leaf, "string", `${where}: CNF leaf must be a string (one nesting level only)`);
      assert.ok(EVIDENCE_TYPE_SET.has(leaf), `${where}: unknown evidence type "${leaf}"`);
    }
  }
}

const FIXTURES = ["client-a-traction-cell.json", "client-b-strap-cert-scope.json"];

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
    assert.equal(fixture.fixtureFormatVersion, 3);
  });

  test(`${file}: carries a well-formed assessment_context`, () => {
    const ctx = fixture.assessment_context;
    assert.ok(ctx, "assessment_context is required");
    assert.ok(Array.isArray(ctx.destination_member_states), "destination_member_states must be an array");
    assert.equal(typeof ctx.food_contact, "boolean", "food_contact must be boolean");
    assert.equal(typeof ctx.persona, "string", "persona must be a string");
    assert.equal(typeof ctx.declared_reusable, "boolean", "declared_reusable must be boolean");
    assert.ok(
      ctx.legal_role_facts && typeof ctx.legal_role_facts === "object",
      "legal_role_facts must be an object",
    );
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
    const check = (where: string, id: string, reasonCode: string, verdict: string) => {
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

  test(`${file}: evidence requirements are well-formed CNF`, () => {
    for (const e of allExpected) {
      assertCnf(`${e.where} / ${e.checkpointId}`, e.evidenceRequirements);
      if (e.verdict === "conditional") {
        assert.ok(
          e.evidenceRequirements.allOf.length > 0,
          `${e.where} / ${e.checkpointId}: conditional needs at least one requirement clause`,
        );
      }
      if (e.verdict === "qualified") {
        assert.equal(
          e.evidenceState,
          "complete",
          `${e.where} / ${e.checkpointId}: qualified must have complete evidence`,
        );
      }
    }
    for (const g of fixture.bomCompletenessGaps) assertCnf(`gap:${g.ref}`, g.evidenceRequirements);
  });

  test(`${file}: overall counts reconcile with the individual expectations`, () => {
    const tally: Record<string, number> = { qualified: 0, conditional: 0, gap: 0, notApplicable: 0 };
    for (const e of allExpected) tally[e.verdict]++;
    tally.gap += fixture.bomCompletenessGaps.length;
    tally.notApplicable += fixture.notApplicable.length;
    assert.deepEqual(tally, fixture.expectedOverall.counts);
  });

  test(`${file}: overall verdict is the worst checkpoint verdict (BOM gaps do not escalate)`, () => {
    // Worst is computed over checkpoint expectations only. BOM-completeness gaps
    // are declaration gaps, not design failures, so they must not raise the
    // overall verdict — the golden run stayed CONDITIONAL despite two gaps.
    const worst = allExpected
      .map((e) => e.verdict)
      .filter((v) => v in VERDICT_SEVERITY)
      .reduce((a, b) => (VERDICT_SEVERITY[b] > VERDICT_SEVERITY[a] ? b : a), "qualified");
    assert.equal(fixture.expectedOverall.verdict, worst);
    for (const g of fixture.bomCompletenessGaps) {
      assert.equal(g.requiredAction, "bom_addition", `gap:${g.ref} must resolve via bom_addition`);
    }
  });

  test(`${file}: legal role — ambiguity is flagged, never silently assigned`, () => {
    if (fixture.legalRole.ambiguous) {
      assert.equal(fixture.legalRole.expectedFlag, "legal_confirmation_required");
    } else {
      assert.notEqual(fixture.legalRole.expectedFlag, "legal_confirmation_required");
    }
  });

  test(`${file}: not-applicable checkpoints carry a recorded scoping note`, () => {
    for (const na of fixture.notApplicable) {
      assert.equal(na.recordedScopingNote, true, `${na.checkpointId}: N/A needs a scoping note`);
    }
  });

  test(`${file}: a scope mismatch yields EVIDENCE_INCOMPLETE, not qualified`, () => {
    // Where a document is on file but its scope does not cover the component,
    // the entry must record the mismatch and stay conditional — an out-of-scope
    // certificate must never read as coverage. Exercises evidenceDocuments[].scope.
    for (const c of fixture.components) {
      for (const e of c.expected) {
        if (!e.scopeMismatch) continue;
        assert.equal(e.scopeMismatch.coversComponent, false, `line ${c.line}: scopeMismatch must be a non-coverage`);
        assert.equal(e.reasonCode, "EVIDENCE_INCOMPLETE", `line ${c.line}: scope mismatch is EVIDENCE_INCOMPLETE`);
        assert.equal(e.verdict, "conditional", `line ${c.line}: scope mismatch stays conditional`);
        assert.notEqual(e.evidenceState, "complete", `line ${c.line}: out-of-scope evidence is not complete`);
        assert.ok(
          (c.evidenceDocuments as { docId: string }[]).some((d) => d.docId === e.scopeMismatch!.documentId),
          `line ${c.line}: scopeMismatch.documentId must reference an on-file document`,
        );
      }
    }
  });
}
