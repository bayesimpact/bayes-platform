import type { FeatureFlagsDto, ProjectPermission, TimeType } from "@caseai-connect/api-contracts"

export type Project = {
  id: string
  name: string
  organizationId: string
  createdAt: TimeType
  updatedAt: TimeType
  featureFlags: FeatureFlagsDto
  agentSessionCategories: ProjectAgentSessionCategory[]
  conversationRetentionDays: number
  permissions: ProjectPermission[]
}

export type RetentionSweepRunStatus = "OK" | "PARTIAL" | "ERROR"

/** One purge run of the retention sweep, for the current project. */
export type RetentionSweepRun = {
  id: string
  ranAt: TimeType
  purgedCount: number
  status: RetentionSweepRunStatus
  /** Run report in markdown. */
  report: string
}

export type RetentionSweepRuns = {
  nextRunAt: TimeType
  runs: RetentionSweepRun[]
}

export type ProjectAgentSessionCategory = {
  id: string
  name: string
}

/** Slim project the current user can access, with their effective permissions. */
export type MyProject = {
  id: string
  name: string
  organizationId: string
  featureFlags: FeatureFlagsDto
  permissions: string[]
}
