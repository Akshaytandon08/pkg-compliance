// Brand wordmark. The official Fitsol logo SVGs are NOT bundled — the product
// owner drops them into /public/brand (see /public/brand/README.md). Until then
// we render a plain TEXT wordmark and NEVER draw or approximate the logo.
//
// Once the files exist, swap the text span for:
//   <img src={variant === "light" ? "/brand/fitsol-logo-white.svg"
//                                  : "/brand/fitsol-logo-full-colour.svg"}
//        alt="Fitsol" className="h-6 w-auto" />
export function Wordmark({ variant = "dark" }: { variant?: "light" | "dark" }) {
  return (
    <span className={`text-base font-bold tracking-tight ${variant === "light" ? "text-white" : "text-n800"}`}>
      pkg-compliance
    </span>
  );
}
