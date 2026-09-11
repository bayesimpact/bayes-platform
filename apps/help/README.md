# Help Center (`apps/help`)

Bilingual (en/fr) static help center for the Bayes Platform, built with
[Astro](https://astro.build) + Tailwind v4. It replaces the previous Notion
site referenced by `VITE_HELP_CENTER_URL` in `apps/web`.

## Commands

Run from the repo root (Turbo) or inside `apps/help`:

```bash
npx turbo dev --filter=@caseai-connect/help        # dev server (http://localhost:4321)
npx turbo build --filter=@caseai-connect/help      # static build to apps/help/dist
npx turbo typecheck --filter=@caseai-connect/help  # astro check (types + templates)
```

## Authoring content

Articles are Markdown/MDX files under `src/content/docs/{locale}/`:

```
src/content/docs/
  en/welcome.md
  fr/welcome.md
```

Each file needs frontmatter (validated in `src/content.config.ts`):

```yaml
---
title: Article title
description: One-line summary shown in lists and search.
category: getting-started # see src/i18n/categories.ts
order: 1 # sort order within the category
updated: 2026-07-08 # optional
draft: false # optional; drafts are hidden in production
---
```

- **Categories** (label + order + icon, per locale) live in
  `src/i18n/categories.ts`.
- **UI strings** (nav, buttons, labels) live in `src/i18n/ui.ts`.
- The article `slug` is the file name, so `en/welcome.md` → `/en/welcome`.
- Client-side search reads a generated per-locale index at
  `/{locale}/search.json`.

## Configuration

- `PUBLIC_APP_URL` (optional) — shows a "Back to the app" link in the header.
  Copy `.env.example` to `.env` to set it locally.
- `PUBLIC_API_BASE_URL` (optional) — the tenant's API base URL, shown on the public
  API reference page. A placeholder is shown when unset.
- `PUBLIC_SITE_URL` (optional) — the public URL of this site, used for canonical
  links and the sitemap. Falls back to `SITE_URL`.
- `SITE_URL` / `SITE_TITLE` / `LOCALES` — see `src/consts.ts`.

In the container image (`apps/help/Dockerfile`) the three `PUBLIC_*` variables are
build-time placeholders replaced when the container starts, from its environment.
One image serves every install; the Helm chart sets them from `urls`.

## Deployment

Static output (`astro build` → `dist/`). Deploy the folder to any static host /
bucket + CDN. Point `apps/web`'s `VITE_HELP_CENTER_URL` at the deployed URL.
