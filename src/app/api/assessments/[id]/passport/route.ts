import QRCode from "qrcode";
import { generatePassport } from "@/db/passport";

// Authoring endpoint (stays behind the access gate): (re)generate the public
// passport for an assessment and return its public URL + a QR data-URL encoding
// that URL. The public VIEW at /passport/[token] is the only ungated surface.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = Number(id);
  if (!Number.isInteger(assessmentId)) {
    return Response.json({ error: "Invalid assessment id." }, { status: 400 });
  }

  try {
    const result = await generatePassport(assessmentId);
    const origin = new URL(request.url).origin;
    const url = `${origin}/passport/${result.token}`;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
    return Response.json(
      { ...result, url, qrDataUrl },
      { status: 200 },
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to generate passport." },
      { status: 500 },
    );
  }
}
