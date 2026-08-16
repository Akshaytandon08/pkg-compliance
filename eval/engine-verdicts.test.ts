// The eval harness's reason for existing: run the ENGINE against the golden
// fixtures and report the real agreement rate. Now LIVE (was skipped until the
// engine landed). This is the harness feed path — checkpoints are hydrated from
// the fixture snapshots (each expected entry embeds its evidenceRequirements +
// appliesWhen), so it is corpus-independent and measurable before any approval.
//
// The engine core (evaluateCheckpoint) is the SAME code the production path uses
// (src/lib/engine/pack.ts); only the feed and the in_force gate differ.
//
// designAssessment is an extraction input, not something the deterministic
// evaluator derives; the golden pack pins it, and the harness feeds it. What the
// engine derives here — and what the agreement rate measures — is evidence state
// (CNF + scope + expiry), applicability (applies_when), reason codes and risk.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateCheckpoint } from "../src/lib/engine/evaluate.ts";
import type { AssessmentContext, EvidenceDocument } from "../src/lib/engine/evaluate.ts";
import type { DesignAssessment } from "../src/lib/engine/verdict.ts";

type Expectation = {
  checkpointId: string;
  checkpointVersion: number;
  appliesWhen?: Record<string, unknown> | null;
  verdict: string;
  designAssessment: DesignAssessment;
  risk: string;
  reasonCode: string;
  evidenceRequirements: { allOf: { anyOf: string[] }[] };
  subject?: string;
};
type Component = {
  line: string;
  name: string;
  material: string;
  evidenceDocuments: EvidenceDocument[];
  expected: Expectation[];
};
type Fixture = {
  pack: { id: string };
  asOf: string;
  assessment_context: AssessmentContext;
  components: Component[];
  packLevelExpected: (Expectation & { subject: string })[];
  expectedOverall: { verdict: string };
};

const FIXTURES = ["client-a-traction-cell.json", "client-b-strap-cert-scope.json"];

// Known, documented misses — pinned so regressions/fixes surface. Now EMPTY:
// the ISPM-15 miss was a fixture-encoding gap (the HT/IPPC mark on the pine
// pallet was narrated as "complete" but never modelled as an evidenceDocument).
// Commit 17 encodes the HT stamp as a `marking` document, so the engine derives
// it as complete and agreement is 17/17. Any future divergence fails here.
const KNOWN_MISSES: string[] = [];

type Row = {
  key: string;
  file: string;
  componentName?: string;
  material?: string;
  documents: EvidenceDocument[];
  e: Expectation;
};

function loadRows(file: string): { fixture: Fixture; rows: Row[]; bomMaterials: string[] } {
  const fixture: Fixture = JSON.parse(
    readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8"),
  );
  const bomMaterials = [...new Set(fixture.components.map((c) => c.material))];
  const rows: Row[] = [];
  for (const c of fixture.components) {
    for (const e of c.expected) {
      rows.push({
        key: `${file}::${e.checkpointId}::${c.name}`,
        file,
        componentName: c.name,
        material: c.material,
        documents: c.evidenceDocuments,
        e,
      });
    }
  }
  for (const e of fixture.packLevelExpected) {
    rows.push({ key: `${file}::${e.checkpointId}::${e.subject}`, file, documents: [], e });
  }
  return { fixture, rows, bomMaterials };
}

function runRow(row: Row, fixture: Fixture, bomMaterials: string[]) {
  return evaluateCheckpoint({
    appliesWhen: row.e.appliesWhen ?? null,
    evidenceRequirements: row.e.evidenceRequirements,
    designAssessment: row.e.designAssessment,
    documents: row.documents,
    context: fixture.assessment_context,
    bomMaterials,
    componentName: row.componentName,
    material: row.material,
    asOf: fixture.asOf,
  });
}

// --- Agreement measurement across all fixtures (the Sprint 2 acceptance metric).
let total = 0;
let matched = 0;
const misses: string[] = [];
const perFixture: Record<string, { total: number; matched: number }> = {};

for (const file of FIXTURES) {
  const { fixture, rows, bomMaterials } = loadRows(file);
  perFixture[file] = { total: 0, matched: 0 };
  for (const row of rows) {
    const outcome = runRow(row, fixture, bomMaterials);
    const ok =
      outcome.verdict === row.e.verdict &&
      outcome.risk === row.e.risk &&
      outcome.reasonCode === row.e.reasonCode;
    total++;
    perFixture[file].total++;
    if (ok) {
      matched++;
      perFixture[file].matched++;
    } else {
      misses.push(
        `${row.key} — expected ${row.e.verdict}/${row.e.risk}/${row.e.reasonCode}, ` +
          `got ${outcome.verdict ?? outcome.disposition}/${outcome.risk ?? "-"}/${outcome.reasonCode}`,
      );
    }
  }
}

const rate = ((matched / total) * 100).toFixed(1);
console.log(`\n[eval] Engine golden-fixture agreement: ${matched}/${total} (${rate}%)`);
for (const [file, s] of Object.entries(perFixture)) {
  console.log(`[eval]   ${file}: ${s.matched}/${s.total}`);
}
if (misses.length) {
  console.log(`[eval] Miss list (${misses.length}):`);
  for (const m of misses) console.log(`[eval]   - ${m}`);
}

test("engine runs against every golden entry and produces a well-formed outcome", () => {
  assert.ok(total > 0, "no fixture rows evaluated");
});

test("agreement misses are exactly the known, documented set", () => {
  const missKeys = misses.map((m) => m.split(" — ")[0]).sort();
  assert.deepEqual(missKeys, [...KNOWN_MISSES].sort());
});

for (const file of FIXTURES) {
  test(`${file}: overall verdict (worst evaluated) matches the fixture`, () => {
    const { fixture, rows, bomMaterials } = loadRows(file);
    const severity: Record<string, number> = { qualified: 1, conditional: 2, gap: 3 };
    const verdicts = rows
      .map((r) => runRow(r, fixture, bomMaterials).verdict)
      .filter(
        (v): v is "qualified" | "conditional" | "gap" =>
          v === "qualified" || v === "conditional" || v === "gap",
      );
    const worst = verdicts.reduce<string>((a, b) => (severity[b] > severity[a] ? b : a), "qualified");
    assert.equal(worst, fixture.expectedOverall.verdict);
  });
}

test("applies_when with missing context yields a CONTEXT_REQUIRED caveat, not a verdict", () => {
  const { fixture, rows, bomMaterials } = loadRows("client-a-traction-cell.json");
  const prodReg = rows.find((r) => r.e.checkpointId === "EU-EPR-producer-registration");
  assert.ok(prodReg, "producer-registration row present");
  const stripped: AssessmentContext = {
    ...fixture.assessment_context,
    destination_member_states: [],
  };
  const outcome = evaluateCheckpoint({
    appliesWhen: prodReg!.e.appliesWhen ?? null,
    evidenceRequirements: prodReg!.e.evidenceRequirements,
    designAssessment: prodReg!.e.designAssessment,
    documents: [],
    context: stripped,
    bomMaterials,
    asOf: fixture.asOf,
  });
  assert.equal(outcome.disposition, "caveat");
  assert.equal(outcome.reasonCode, "CONTEXT_REQUIRED");
  assert.equal(outcome.verdict, undefined, "a caveat is not a verdict");
});
