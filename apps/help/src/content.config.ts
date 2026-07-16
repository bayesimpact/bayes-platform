import { defineCollection, z } from "astro:content"
import { glob } from "astro/loaders"

/**
 * The `docs` collection holds every help-center article.
 * Files live under `src/content/docs/{locale}/{...slug}.{md,mdx}`, so the
 * generated entry `id` is `"{locale}/{slug}"` — we split it in page routes.
 */
const docs = defineCollection({
  // Absolute base (resolved from this config file, not `process.cwd()`) so the
  // glob still finds the docs when the build runs from the monorepo root — e.g.
  // via `turbo build` or on Vercel — and not only from `apps/help`.
  loader: glob({ pattern: "**/*.{md,mdx}", base: new URL("./content/docs", import.meta.url) }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Category id — see `src/i18n/categories.ts` for labels/order.
    category: z.string(),
    // Sort order within the category (lower = higher in the list).
    order: z.number().default(100),
    // Optional publication metadata.
    updated: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
})

export const collections = { docs }
