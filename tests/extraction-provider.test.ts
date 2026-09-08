// A3 — the ExtractionProvider contract and the Anthropic adapter. A fake client
// stands in for the SDK, so these run with no network and no API key. The adapter
// must: map a well-formed tool call into claims with provenance, drop malformed
// claims without patching them, treat "no structured output" as REFUSED (zero
// claims, never invented), and build the right content block per content type.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AnthropicExtractionProvider,
  DOC_CLASSES,
  PROMPTS,
  buildClaimToolSchema,
  getPrompt,
  type AnthropicLike,
  type AnthropicMessageResponse,
  type ExtractionInput,
} from "../src/lib/extraction/index.ts";

function fakeClient(response: AnthropicMessageResponse): { client: AnthropicLike; lastBody: () => Record<string, unknown> } {
  let captured: Record<string, unknown> = {};
  const client: AnthropicLike = {
    messages: {
      create: async (body) => {
        captured = body;
        return response;
      },
    },
  };
  return { client, lastBody: () => captured };
}

const pdfInput: ExtractionInput = {
  docClass: "lab_test_report",
  bytes: new Uint8Array([1, 2, 3]),
  contentType: "application/pdf",
};

function toolUseResponse(claims: unknown[]): AnthropicMessageResponse {
  return {
    content: [{ type: "tool_use", name: "record_claims", input: { claims } }],
    usage: { input_tokens: 1200, output_tokens: 80 },
    stop_reason: "tool_use",
  };
}

test("a well-formed tool call maps into claims with provenance and usage", async () => {
  const { client } = fakeClient(
    toolUseResponse([
      {
        claim_type: "measured_parameter",
        parameter: "lead",
        value: "0.4",
        unit: "mg/kg",
        confidence: 0.97,
        provenance: { page: 2, span: [10, 20] },
      },
    ]),
  );
  const provider = new AnthropicExtractionProvider({ client, model: "claude-sonnet-5" });
  const result = await provider.extract(pdfInput);

  assert.equal(result.status, "succeeded");
  assert.equal(result.provider, "anthropic");
  assert.equal(result.model, "claude-sonnet-5");
  assert.equal(result.promptVersion, getPrompt("lab_test_report").version);
  assert.equal(result.claims.length, 1);
  assert.deepEqual(result.claims[0].provenance, { page: 2, span: [10, 20] });
  assert.equal(result.claims[0].value, "0.4");
  assert.equal(result.usage.inputTokens, 1200);
  assert.equal(result.usage.outputTokens, 80);
});

test("no structured output is REFUSED — zero claims, never invented", async () => {
  const { client } = fakeClient({
    content: [{ type: "text", text: "I could not read this document." }],
    usage: { input_tokens: 500, output_tokens: 12 },
    stop_reason: "end_turn",
  });
  const result = await new AnthropicExtractionProvider({ client }).extract(pdfInput);
  assert.equal(result.status, "refused");
  assert.equal(result.claims.length, 0);
  assert.match(result.error ?? "", /no structured claims/);
});

test("malformed claims are dropped, not patched; valid ones survive", async () => {
  const { client } = fakeClient(
    toolUseResponse([
      { claim_type: "measured_parameter", confidence: 0.9, provenance: { page: 1 } }, // valid
      { claim_type: "measured_parameter", provenance: { page: 1 } }, // no confidence
      { claim_type: "measured_parameter", confidence: 0.9 }, // no provenance
      { confidence: 0.9, provenance: { page: 1 } }, // no claim_type
    ]),
  );
  const result = await new AnthropicExtractionProvider({ client }).extract(pdfInput);
  assert.equal(result.status, "succeeded");
  assert.equal(result.claims.length, 1, "only the one complete claim survives");
});

test("PDF goes as a document block with citations; an image goes as an image block", async () => {
  const { client, lastBody } = fakeClient(toolUseResponse([]));
  const provider = new AnthropicExtractionProvider({ client });

  await provider.extract(pdfInput);
  let content = (lastBody().messages as Array<{ content: Array<Record<string, unknown>> }>)[0].content;
  const doc = content.find((b) => b.type === "document") as Record<string, unknown>;
  assert.ok(doc, "PDF must produce a document block");
  assert.deepEqual(doc.citations, { enabled: true });
  assert.equal((doc.source as Record<string, unknown>).media_type, "application/pdf");

  await provider.extract({ ...pdfInput, contentType: "image/png" });
  content = (lastBody().messages as Array<{ content: Array<Record<string, unknown>> }>)[0].content;
  const img = content.find((b) => b.type === "image") as Record<string, unknown>;
  assert.ok(img, "an image must produce an image block");
  assert.equal((img.source as Record<string, unknown>).media_type, "image/png");
});

test("every document class has a versioned prompt and a strict tool schema", () => {
  for (const dc of DOC_CLASSES) {
    const p = PROMPTS[dc];
    assert.equal(p.docClass, dc);
    assert.match(p.version, /^\d+\.\d+\.\d+$/, `${dc} needs a semver version`);
    assert.ok(p.changelog.length > 0, `${dc} needs a changelog`);
    assert.ok(p.claimTypes.length > 0, `${dc} needs claim types`);

    const schema = buildClaimToolSchema(dc) as {
      properties: { claims: { items: { required: string[]; additionalProperties: boolean } } };
    };
    const item = schema.properties.claims.items;
    assert.equal(item.additionalProperties, false, `${dc} claim schema must be strict`);
    assert.deepEqual(item.required, ["claim_type", "confidence", "provenance"]);
  }
});
