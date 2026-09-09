import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the document-generation assets INSIDE the serverless functions that
  // render DoC drafts. Without this, the bundled DM Sans TTFs and pdfkit's
  // built-in AFM metrics are not traced into the function, and PDF/docx
  // generation fails at runtime on Vercel. Keyed on the two routes that call
  // renderPdf/renderDocx (the POST generator and the GET download/preview).
  outputFileTracingIncludes: {
    "/api/assessments/[id]/doc-draft": [
      "./assets/fonts/**/*",
      "./node_modules/pdfkit/js/data/*.afm",
    ],
    "/api/assessments/[id]/doc-draft/[draftId]": [
      "./assets/fonts/**/*",
      "./node_modules/pdfkit/js/data/*.afm",
    ],
  },
};

export default nextConfig;
