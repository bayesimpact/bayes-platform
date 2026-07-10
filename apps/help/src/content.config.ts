import { defineCollection, z } from "astro:content"
import { glob } from "astro/loaders"

/**
 * The `docs` collection holds every help-center article.
 * Files live under `src/content/docs/{locale}/{...slug}.{md,mdx}`, so the
 * generated entry `id` is `"{locale}/{slug}"` — we split it in page routes.
 */
const docs = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/docs" }),
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
