import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

// DM Sans is the Fitsol UI/body typeface (weights 400/500/700).
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "pkg-compliance",
  description:
    "Packaging compliance qualification screening and evidence assembly",
};

// The ROOT layout is intentionally minimal — html/body/fonts only, no app
// navigation. The gated application chrome lives in the (app) route group
// layout, so it never renders on the PUBLIC passport route (src/app/passport),
// which would otherwise emit prefetch/navigation requests to gated routes and
// trip a Basic Auth challenge on the public page. See src/proxy.ts.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GB"
      className={`${dmSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-page text-n700">
        {children}
      </body>
    </html>
  );
}
