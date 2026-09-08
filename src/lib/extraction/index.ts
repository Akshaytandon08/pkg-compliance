export * from "./types.ts";
export { PROMPTS, getPrompt, buildClaimToolSchema } from "./prompts.ts";
export type { DocClassPrompt, PromptChange } from "./prompts.ts";
export { AnthropicExtractionProvider } from "./anthropic.ts";
export type { AnthropicLike, AnthropicMessageResponse } from "./anthropic.ts";
export { proposeEvidenceAttachments, EVIDENCE_TYPE_BY_CLAIM } from "./matching.ts";
export type {
  ProposedAttachment,
  ProposeInput,
  MatchComponent,
  MatchCheckpoint,
} from "./matching.ts";
