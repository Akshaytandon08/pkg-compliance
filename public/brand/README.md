# Brand assets

Drop the **official Fitsol logo SVGs** into this folder. Until they are present,
the app renders a plain text wordmark (see `src/app/_components/Wordmark.tsx`) and
never draws or approximates the logo.

Expected files (exact names):

| File | Use |
|---|---|
| `fitsol-logo-full-colour.svg` | Full-colour logo — used on white surfaces (e.g. the public passport page). |
| `fitsol-logo-white.svg` | White logo — used on the dark-teal header bar. |
| `fitsol-logomark.svg` | Logomark only (no wordmark) — compact / favicon / mobile. |

Once the files are in place, swap the text span in `Wordmark.tsx` for an `<img>`
pointing at the matching file (the component comments show the exact markup).
Keep the SVGs optimised and do not recolour them.
