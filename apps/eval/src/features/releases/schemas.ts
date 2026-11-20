import { z } from "zod"

/** `version.json`, which each production build publishes beside its files (vite.config.ts). */
export const publishedBuildSchema = z.object({ buildId: z.string().min(1) })
