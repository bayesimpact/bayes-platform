import { z } from "zod"
import type { FeatureFlagsDto } from "../feature-flags/feature-flags.dto"
import type { TimeType } from "../generic"
import type { ProjectPermission } from "../rbac/permissions"

export type ProjectDto = {
  id: string
  name: string
  organizationId: string
  createdAt: TimeType
  updatedAt: TimeType
  featureFlags: FeatureFlagsDto
  agentSessionCategories: ProjectAgentSessionCategoryDto[]
  /** GDPR retention: conversations older than this many days get their content purged. Always set. */
  conversationRetentionDays: number
  /** The caller's permissions on the project, limited to `PROJECT_SCOPED_PERMISSIONS`. */
  permissions: ProjectPermission[]
}

export const CONVERSATION_RETENTION_MIN_DAYS = 1
export const CONVERSATION_RETENTION_MAX_DAYS = 3650

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(100).trim(),
    conversationRetentionDays: z
      .number()
      .int()
      .min(CONVERSATION_RETENTION_MIN_DAYS)
      .max(CONVERSATION_RETENTION_MAX_DAYS)
      .optional(),
  })
  .strict()

export type UpdateProjectRequestDto = z.infer<typeof updateProjectSchema>

export type RetentionSweepRunStatusDto = "OK" | "PARTIAL" | "ERROR"

/** One purge run of the retention sweep, for one project. */
export type RetentionSweepRunDto = {
  id: string
  ranAt: TimeType
  purgedCount: number
  status: RetentionSweepRunStatusDto
  /** Run report in markdown. */
  report: string
}

export type RetentionSweepRunsResponseDto = {
  /** Next scheduled sweep, from the cron pattern. */
  nextRunAt: TimeType
  runs: RetentionSweepRunDto[]
}

export type ProjectAgentSessionCategoryDto = {
  id: string
  name: string
}

/** Slim project row for GET projects/mine, with the user's effective permissions. */
export type MyProjectDto = {
  id: string
  name: string
  organizationId: string
  featureFlags: FeatureFlagsDto
  permissions: string[]
}
