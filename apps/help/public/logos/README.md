# Bayes Impact logos

Official logo assets (provided by the user), set aside for reuse across the help
center. Two families — the **mark** (icon only) and the **full lockup** (mark +
"BAYES IMPACT" wordmark) — each in four colourways.

## Files

| File | Family | Colourway | Use on |
|------|--------|-----------|--------|
| `mark-gold-dots-black.svg`   | mark   | gold cross + black dots      | light surfaces |
| `mark-gold-dots-white.svg`   | mark   | gold cross + white dots      | dark surfaces |
| `mark-black.svg`             | mark   | mono black                   | light, single-colour |
| `mark-white.svg`             | mark   | mono white                   | dark, single-colour |
| `lockup-gold-dots-black.svg` | lockup | gold cross + black dots/word | light surfaces |
| `lockup-gold-dots-white.svg` | lockup | gold cross + white dots/word | dark surfaces |
| `lockup-black.svg`           | lockup | mono black                   | light, single-colour |
| `lockup-white.svg`           | lockup | mono white                   | dark, single-colour |

Mark viewBox: `0 0 415.11 408.36` · Lockup viewBox: `0 0 1608.25 408.82`.
Brand gold = `#dbccaf`.

## Correspondence rule (matches bayesimpact.org)

- The **cross is always gold** (`#dbccaf`); the **dots + wordmark** switch with the
  background: **black on light**, **white on dark**.
- Prefer the **two-tone** (`gold-dots-*`) versions; the mono `black`/`white` files
  are fallbacks for one-colour contexts (stamps, monochrome print).

## In-app usage

These static files are the archive. The rendered header/footer use the
token-driven components instead, which reproduce the same two-tone rule live:

- `src/components/LogoFull.astro` — the lockup (gold cross + `currentColor`), used in
  the header (`text-foreground`) and footer (`text-white`).
- `src/components/Logo.astro` — the mark only (same rule).
- `public/favicon.svg` — the mark (gold cross + near-black dots).
