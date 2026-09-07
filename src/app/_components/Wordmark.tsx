// Brand wordmark — the official Fitsol logo lockups from /public/brand.
//   light  → white logo, for the dark-teal header bar.
//   dark   → full-colour logo (green mark + navy wordmark), for white surfaces
//            such as the public passport.
// The SVGs are a fixed aspect lockup; height is fixed and width follows.
export function Wordmark({ variant = "dark" }: { variant?: "light" | "dark" }) {
  const src = variant === "light" ? "/brand/fitsol-logo-white.svg" : "/brand/fitsol-logo-full-colour.svg";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand SVG, no optimisation needed
    <img src={src} alt="Fitsol" className="h-6 w-auto" />
  );
}
