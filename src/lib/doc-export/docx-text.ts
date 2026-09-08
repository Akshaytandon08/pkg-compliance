import JSZip from "jszip";

// Extract the visible text from a produced .docx (a zip of XML parts). Reads the
// document body plus every header/footer part (so the watermark banner is included),
// concatenating the text runs (<w:t>). Used by the output-level language guardrail:
// the generated document is checked with the SAME speaker-based rules as the report.
export async function docxToText(buffer: Buffer | Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const parts: string[] = [];
  const wanted = Object.keys(zip.files).filter(
    (name) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(name),
  );
  for (const name of wanted) {
    const xml = await zip.files[name].async("string");
    for (const m of xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)) {
      parts.push(decodeXmlEntities(m[1]));
    }
  }
  return parts.join(" ");
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
