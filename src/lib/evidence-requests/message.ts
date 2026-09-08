import { randomBytes } from "node:crypto";

// B1 — magic-link evidence requests: token + the message the ASSESSOR sends.
// v1 sends no mail itself. It generates a subject + body for the assessor to send
// through their own channel; an automated per-message send happens only when
// RESEND/SMTP is configured AND the assessor approves that message (never silent).

/** Unguessable public token for /evidence/[token]. Not derived from any id. */
export function generateRequestToken(): string {
  return randomBytes(16).toString("hex");
}

export interface RequestMessageInput {
  packName: string;
  checkpointId: string;
  /** Plain-language requirement text for the gap, if known. */
  requirementText?: string | null;
  componentName?: string | null;
  /** Absolute /evidence/[token] URL the supplier opens. */
  url: string;
  expiresAt?: Date | null;
  note?: string | null;
}

export interface RequestMessage {
  subject: string;
  body: string;
}

// A plain, neutral request. It asks the supplier to upload a document — it makes
// no compliance claim and issues nothing; the wording is a drafting aid for the
// assessor to adapt.
export function renderRequestMessage(input: RequestMessageInput): RequestMessage {
  const scope = input.componentName ? ` for "${input.componentName}"` : "";
  const subject = `Document request: ${input.packName}${scope}`;
  const lines: string[] = [
    `Hello,`,
    ``,
    `We are compiling the documentation for ${input.packName}${scope} and would`,
    `appreciate a supporting document from you.`,
    ``,
  ];
  if (input.requirementText) {
    lines.push(`What is needed: ${input.requirementText}`, ``);
  }
  lines.push(
    `Please upload the file (PDF, JPG or PNG) using this secure link:`,
    input.url,
    ``,
  );
  if (input.expiresAt) {
    lines.push(`The link expires on ${input.expiresAt.toISOString().slice(0, 10)}.`, ``);
  }
  if (input.note) {
    lines.push(input.note, ``);
  }
  lines.push(
    `The link is private to this request. If you did not expect this message,`,
    `you can ignore it.`,
    ``,
    `Thank you.`,
  );
  return { subject, body: lines.join("\n") };
}

/** True when an outbound-mail transport is configured. When false, v1 only
 *  generates the message for the assessor to send by hand. */
export function isOutboundMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY || process.env.SMTP_URL);
}

/** True when a request is past its expiry (by status or by expires_at). Lives
 *  here (not in a component) so the time read stays out of render. */
export function isRequestExpired(
  req: { status: string; expiresAt: Date | null },
  now = Date.now(),
): boolean {
  if (req.status === "expired") return true;
  return req.expiresAt != null && req.expiresAt.getTime() < now;
}
