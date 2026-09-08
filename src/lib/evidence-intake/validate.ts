// B2 — what the public intake accepts. Only PDF/JPG/PNG, only up to the size cap.
// These are enforced server-side in the upload route; a client hint is not trusted.
export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type AllowedUploadType = (typeof ALLOWED_UPLOAD_TYPES)[number];

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export type UploadValidation =
  | { ok: true; contentType: AllowedUploadType }
  | { ok: false; reason: "unsupported-type" | "too-large" | "empty" };

export function validateUpload(input: { contentType: string; size: number }): UploadValidation {
  if (input.size <= 0) return { ok: false, reason: "empty" };
  if (input.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "too-large" };
  if (!ALLOWED_UPLOAD_TYPES.includes(input.contentType as AllowedUploadType)) {
    return { ok: false, reason: "unsupported-type" };
  }
  return { ok: true, contentType: input.contentType as AllowedUploadType };
}

// Sniff the real content type from the leading bytes, so a mislabelled or spoofed
// client MIME cannot smuggle a disallowed file past validation. Returns null when
// the bytes match none of the allowed formats.
export function sniffContentType(bytes: Uint8Array): AllowedUploadType | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf"; // %PDF
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"; // JPEG SOI
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png"; // PNG signature
  }
  return null;
}
