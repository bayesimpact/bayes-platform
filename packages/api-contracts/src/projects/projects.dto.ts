import { z } from "zod"
import type { FeatureFlagsDto } from "../feature-flags/feature-flags.dto"
import type { TimeType } from "../generic"

export type ProjectDto = {
  id: string
  name: string
  organizationId: string
  createdAt: TimeType
  updatedAt: TimeType
  featureFlags: FeatureFlagsDto
  agentSessionCategories: ProjectAgentSessionCategoryDto[]
  /** GDPR retention: conversations older than this many days get their content purged. Null = never. */
  conversationRetentionDays: number | null
}

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(100).trim(),
    conversationRetentionDays: z.number().int().min(1).max(3650).nullable().optional(),
  })
  .strict()

export type UpdateProjectRequestDto = z.infer<typeof updateProjectSchema>

export type ProjectAgentSessionCategoryDto = {
  id: string
  name: string
}
