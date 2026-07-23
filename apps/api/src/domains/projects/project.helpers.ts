import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import type { Project } from "./project.entity"
import type { ProjectModel } from "./project.model"

export const toProjectModel = (project: Project, permissions: string[]): ProjectModel => {
  return {
    id: project.id,
    organizationId: project.organizationId,
    name: project.name,
    featureFlags: (project.featureFlags ?? []).map(
      (featureFlag) => featureFlag.featureFlagKey as FeatureFlagKey,
    ),
    permissions,
  }
}
