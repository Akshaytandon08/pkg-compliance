// The document's own text layer, used to GROUND extracted values: a value the
// model reports must actually appear in the document. Also the signal for which
// safeguard applies — a document with a usable text layer can be grounded
// verbatim; one without (a photo or a scan) cannot, and gets two-pass agreement
// instead. Cost matters here: grounding is free, two-pass doubles the API spend,
// so it is reserved for documents that genuinely have no text.

/** Below this many characters we treat a PDF as scanned (no usable text layer).
 *  A cover-page-only text layer on a scan yields a few dozen characters; a real
 *  one-page declaration in this corpus yields ~1,200. */
const MIN_TEXT_LAYER_CHARS = 200;

/** Normalise for comparison: case, whitespace runs and punctuation spacing. Kept
 *  deliberately weak — it must not let a DIFFERENT string match. */
export function normalizeForGrounding(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‐-―]/g, "-") // unicode dashes → hyphen
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract the text layer, or null when the document has none (image, or a scan
 * with no embedded text). Never throws: a document we cannot read is simply
 * "no text layer", which routes it to the two-pass safeguard.
 */
export async function extractTextLayer(
  bytes: Uint8Array,
  contentType: string,
): Promise<string | null> {
  if (contentType !== "application/pdf") return null; // image tiers
  try {
    const { extractText } = await import("unpdf");
    // pdf.js TAKES OWNERSHIP of the buffer it is handed and detaches it, which
    // would leave the caller holding an empty Uint8Array — and the model would
    // then be sent a zero-byte PDF ("PDF cannot be empty"). Hand it a copy so
    // this function never mutates its input.
    const result = await extractText(new Uint8Array(bytes), { mergePages: true });
    const text = Array.isArray(result.text) ? result.text.join("\n") : String(result.text ?? "");
    return text.trim().length >= MIN_TEXT_LAYER_CHARS ? text : null;
  } catch {
    return null;
  }
}

/** Is `snippet` genuinely present in the document's text? */
export function snippetIsGrounded(snippet: string, textLayer: string): boolean {
  const needle = normalizeForGrounding(snippet);
  if (needle.length < 3) return false; // too short to be evidence of anything
  return normalizeForGrounding(textLayer).includes(needle);
}
