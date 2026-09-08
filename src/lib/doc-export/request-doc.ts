import type { DocBlock, DraftDocument } from "./model.ts";
import { FITSOL_BRAND } from "./model.ts";
import { DISCLAIMER, type TemplateInput, type TemplateKind } from "../report/templates.ts";
import type { Threshold } from "../../db/schema.ts";

// The supplier-declaration and lab-test REQUEST templates, retrofitted to the
// controlled document model so they export as .docx + PDF (same library as the DoC
// draft) rather than markdown. These are drafting aids the user SENDS OUT asking a
// supplier/lab to issue a document — they are never conformity documents and never
// issued by this tool (the disclaimer says so, verbatim from templates.ts). No
// diagonal DRAFT watermark: a request is a letter, not a draft declaration.

function thresholdBullets(ts: Threshold[] | null): string[] {
  if (!ts || ts.length === 0) return ["(no numeric limit is set on this checkpoint — confirm the applicable limit)"];
  return ts.map((t) => `${t.parameter} ${t.operator} ${t.value} ${t.unit}${t.applies_when ? ` (${t.applies_when})` : ""}`);
}

function pinpoint(citation: string): string {
  return citation.split(". http")[0];
}

export function requestDocTitle(kind: TemplateKind): string {
  return kind === "lab_test" ? "Request for a laboratory test" : "Request for a supplier declaration";
}

export function buildRequestModel(kind: TemplateKind, input: TemplateInput): DraftDocument {
  const { component, checkpoint } = input;
  const blocks: DocBlock[] = [
    { type: "wordmark" },
    { type: "title", text: requestDocTitle(kind) },
    { type: "notice", text: DISCLAIMER },
    {
      type: "metaRows",
      rows: [
        ["To", kind === "lab_test" ? "[accredited laboratory — NABL (India) / ILAC-recognised]" : `[supplier of ${component.name}]`],
        ["From", "[your organisation]"],
        ["Date", input.asOf],
        ["Subject", `${input.packName} — ${component.name} (${component.material})`],
      ],
    },
  ];

  if (kind === "lab_test") {
    blocks.push(
      { type: "paragraph", text: "We ask you to test the component below and issue a test report:" },
      { type: "paragraph", text: `Component: ${component.name} (${component.material}${component.composition ? `; ${component.composition}` : ""})` },
      { type: "heading", text: "Parameters and limits to test against" },
      { type: "bullets", items: thresholdBullets(checkpoint.thresholds) },
      { type: "paragraph", text: `Method: ${checkpoint.testMethod ?? "as appropriate to the parameters above"}` },
      { type: "paragraph", text: "Please include in your report: the measured values, an explicit pass/fail against each limit, the method reference, the sample identity, your accreditation number, and the report date." },
    );
  } else {
    blocks.push(
      { type: "paragraph", text: "We are assembling packaging compliance evidence and ask you to provide a signed declaration covering the component above, addressing the following requirement:" },
      { type: "paragraph", text: checkpoint.requirementText },
      { type: "heading", text: "Please confirm, in a signed and dated declaration on your letterhead" },
      {
        type: "bullets",
        items: [
          ...thresholdBullets(checkpoint.thresholds),
          ...(checkpoint.testMethod ? [`Basis / reference method: ${checkpoint.testMethod}`] : []),
          `The exact component / material this declaration covers (${component.name}${component.composition ? `; ${component.composition}` : ""})`,
          "The name and position of the signatory, and the date",
        ],
      },
    );
  }

  blocks.push(
    { type: "paragraph", muted: true, text: `Applicable rule: ${pinpoint(checkpoint.citation)}` },
    { type: "paragraph", text: kind === "lab_test" ? "Please issue your test report at your earliest convenience." : "Please return the signed declaration at your earliest convenience." },
  );

  return {
    watermark: "Request template — a drafting aid prepared with Fitsol; not a declaration or certificate, and not issued by this tool.",
    brand: FITSOL_BRAND,
    blocks,
    title: `${requestDocTitle(kind)} — ${input.packName}`,
    language: "en",
  };
}
