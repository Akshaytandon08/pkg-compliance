// Request-document templates. These are DRAFTING AIDS the user sends OUT to
// their supplier or laboratory, asking THEM to issue a declaration or a test
// report. They are never conformity documents and are never issued by this
// system — the wording makes that explicit (brief §1). Populated from the
// checkpoint's threshold, reference method and the component details.
import type { Threshold } from "../../db/schema.ts";

export type TemplateInput = {
  packName: string;
  asOf: string;
  component: { name: string; material: string; composition?: string | null };
  checkpoint: {
    id: string;
    requirementText: string;
    thresholds: Threshold[] | null;
    testMethod: string | null;
    citation: string;
  };
};

export type TemplateKind = "supplier_declaration" | "lab_test";

const DISCLAIMER =
  "This is a request template you send out. It asks the recipient to issue the document. " +
  "It is a drafting aid only — it is not a declaration of conformity, not a certificate, and it is not issued by this tool.";

function thresholdLines(ts: Threshold[] | null): string {
  if (!ts || ts.length === 0) return "- (no numeric limit is set on this checkpoint — confirm the applicable limit)";
  return ts
    .map((t) => `- ${t.parameter} ${t.operator} ${t.value} ${t.unit}${t.applies_when ? ` (${t.applies_when})` : ""}`)
    .join("\n");
}

function pinpoint(citation: string): string {
  return citation.split(". http")[0];
}

export function supplierDeclarationRequest(input: TemplateInput): string {
  const { component, checkpoint } = input;
  const lines = [
    "# Request for a supplier declaration",
    "",
    `> ${DISCLAIMER}`,
    "",
    `To: [supplier of ${component.name}]`,
    "From: [your organisation]",
    `Date: ${input.asOf}`,
    `Subject: ${input.packName} — ${component.name} (${component.material})`,
    "",
    "We are assembling packaging compliance evidence and ask you to provide a signed declaration covering the component above, addressing the following requirement:",
    "",
    checkpoint.requirementText,
    "",
    "Please confirm, in a signed and dated declaration on your letterhead:",
    thresholdLines(checkpoint.thresholds),
    checkpoint.testMethod ? `- Basis / reference method: ${checkpoint.testMethod}` : null,
    `- The exact component / material this declaration covers (${component.name}${component.composition ? `; ${component.composition}` : ""})`,
    "- The name and position of the signatory, and the date",
    "",
    `Applicable rule: ${pinpoint(checkpoint.citation)}`,
    "",
    "Please return the signed declaration at your earliest convenience.",
    "",
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

export function labTestRequest(input: TemplateInput): string {
  const { component, checkpoint } = input;
  const lines = [
    "# Request for a laboratory test",
    "",
    `> ${DISCLAIMER}`,
    "",
    "To: [accredited laboratory — NABL (India) / ILAC-recognised]",
    "From: [your organisation]",
    `Date: ${input.asOf}`,
    `Subject: ${input.packName} — ${component.name} (${component.material})`,
    "",
    "We ask you to test the component below and issue a test report:",
    "",
    `Component: ${component.name} (${component.material}${component.composition ? `; ${component.composition}` : ""})`,
    "",
    "Parameters and limits to test against:",
    thresholdLines(checkpoint.thresholds),
    checkpoint.testMethod ? `- Method: ${checkpoint.testMethod}` : "- Method: as appropriate to the parameters above",
    "",
    "Please include in your report: the measured values, an explicit pass/fail against each limit, the method reference, the sample identity, your accreditation number, and the report date.",
    "",
    `Applicable rule: ${pinpoint(checkpoint.citation)}`,
    "",
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

export function renderTemplate(kind: TemplateKind, input: TemplateInput): string {
  return kind === "lab_test" ? labTestRequest(input) : supplierDeclarationRequest(input);
}
