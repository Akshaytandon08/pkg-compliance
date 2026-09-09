import { buildClaimToolSchema, getPrompt } from "./prompts.ts";
import { LEGIBILITY } from "./types.ts";
import type {
  ExtractedClaimDraft,
  ExtractionInput,
  ExtractionProvider,
  ExtractionResult,
} from "./types.ts";
import { validateClaims } from "./validate.ts";

// Narrow view of the Anthropic Messages API. The request/response shapes here are
// pinned to the current Claude API reference (strict tool use for structured
// output; base64 document/image content blocks; citations on documents) — see
// prompts/README.md. Keeping the surface narrow lets tests inject a fake client
// with no network and no key, and keeps the request shape under our control.
export interface AnthropicMessageResponse {
  content: Array<{ type: string; name?: string; input?: unknown; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string | null;
}
export interface AnthropicLike {
  messages: { create(body: Record<string, unknown>): Promise<AnthropicMessageResponse> };
}

const TOOL_NAME = "record_claims";
const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_TOKENS = 4096;

// The extraction tool the model is forced to call. `strict: true` +
// additionalProperties:false makes the returned arguments schema-valid.
function extractionTool(input: ExtractionInput) {
  return {
    name: TOOL_NAME,
    description:
      "Record the values transcribed from the document as structured claims with provenance. Call this exactly once.",
    strict: true,
    input_schema: buildClaimToolSchema(input.docClass),
  };
}

function documentBlock(input: ExtractionInput) {
  const data = Buffer.from(input.bytes).toString("base64");
  if (input.contentType === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data },
      citations: { enabled: true }, // char/page provenance cross-check
    };
  }
  // image/jpeg | image/png → vision block (scans/photos with no text layer)
  return { type: "image", source: { type: "base64", media_type: input.contentType, data } };
}

interface RawClaim {
  claim_type: string;
  parameter?: string;
  value?: string;
  unit?: string;
  test_method?: string;
  issuer?: string;
  accreditation_ref?: string;
  issue_date?: string;
  expiry?: string;
  scope_text?: string;
  legibility?: string;
  confidence: number;
  provenance: { page: number; span?: [number, number]; bbox?: [number, number, number, number] };
}

function toDraft(c: RawClaim): ExtractedClaimDraft {
  return {
    claimType: c.claim_type,
    parameter: c.parameter ?? null,
    value: c.value ?? null,
    unit: c.unit ?? null,
    testMethod: c.test_method ?? null,
    issuer: c.issuer ?? null,
    accreditationRef: c.accreditation_ref ?? null,
    issueDate: c.issue_date ?? null,
    expiry: c.expiry ?? null,
    scopeText: c.scope_text ?? null,
    legibility: (LEGIBILITY as readonly string[]).includes(c.legibility ?? "")
      ? (c.legibility as ExtractedClaimDraft["legibility"])
      : null,
    confidence: c.confidence,
    provenance: c.provenance,
  };
}

// A claim is only usable if it carries the required shape. Anything missing
// claim_type, a numeric confidence, or a page → dropped, not patched. We never
// fabricate a missing field to make a malformed claim look complete.
function isUsable(c: unknown): c is RawClaim {
  if (typeof c !== "object" || c === null) return false;
  const r = c as Record<string, unknown>;
  if (typeof r.claim_type !== "string" || r.claim_type.length === 0) return false;
  if (typeof r.confidence !== "number" || Number.isNaN(r.confidence)) return false;
  const p = r.provenance as Record<string, unknown> | undefined;
  if (!p || typeof p.page !== "number") return false;
  return true;
}

export class AnthropicExtractionProvider implements ExtractionProvider {
  readonly name = "anthropic";
  readonly model: string;
  private readonly client: AnthropicLike | undefined;

  // In production `client` is created lazily from ANTHROPIC_API_KEY (the SDK reads
  // it from env; we never read or log the key ourselves). Tests inject a fake.
  constructor(opts: { model?: string; client?: AnthropicLike } = {}) {
    this.model = opts.model ?? process.env.EXTRACTION_MODEL ?? DEFAULT_MODEL;
    this.client = opts.client;
  }

  private async resolveClient(): Promise<AnthropicLike> {
    if (this.client) return this.client;
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set — cannot run extraction");
    }
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    return new Anthropic() as unknown as AnthropicLike;
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const prompt = getPrompt(input.docClass);
    const base = {
      provider: this.name,
      model: this.model,
      promptVersion: prompt.version,
    };
    const startedAt = Date.now();

    let response: AnthropicMessageResponse;
    try {
      const client = await this.resolveClient();
      response = await client.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        // Sampling pinned for reproducibility (Part 3a): extraction is
        // transcription, not generation, and the harness measures run-to-run
        // variance. Recorded in prompt_version so a run is attributable.
        temperature: 0,
        system: prompt.instruction,
        tools: [extractionTool(input)],
        tool_choice: { type: "tool", name: TOOL_NAME },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the claims from this document per your instructions." },
              documentBlock(input),
            ],
          },
        ],
      });
    } catch (err) {
      return {
        ...base,
        status: "failed",
        claims: [],
        usage: { inputTokens: 0, outputTokens: 0 },
        latencyMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : "extraction request failed",
      };
    }

    const latencyMs = Date.now() - startedAt;
    const usage = {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };

    const toolUse = response.content.find((b) => b.type === "tool_use" && b.name === TOOL_NAME);
    const rawClaims = (toolUse?.input as { claims?: unknown[] } | undefined)?.claims;
    if (!toolUse || !Array.isArray(rawClaims)) {
      // No structured output → refused. Zero claims, never invented.
      return {
        ...base,
        status: "refused",
        claims: [],
        usage,
        latencyMs,
        error: "model returned no structured claims",
      };
    }

    // Deterministic post-validation: a value of the wrong type for its field, or
    // a value on a field the model itself marked not fully legible, is rejected
    // (nulled, offending text preserved) so it can never be stored as a value.
    const claims = validateClaims(rawClaims.filter(isUsable).map(toDraft));
    return { ...base, status: "succeeded", claims, usage, latencyMs };
  }
}
