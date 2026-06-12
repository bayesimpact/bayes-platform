import type {
  FeatureFlagKey,
  FeatureFlagsDto,
  ProjectAgentSessionCategoryDto,
  ProjectDto,
  TimeType,
} from "@caseai-connect/api-contracts"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import type { FeatureFlag } from "../feature-flags/feature-flag.entity"
import type { Project } from "./project.entity"

export const requestToProjectPolicyContext = (request: EndpointRequestWithProject) => {
  return {
    organizationMembership: request.organizationMembership,
    projectMembership: request.projectMembership,
    project: request.project,
  }
}
export const requestToAgentPolicyContext = (request: EndpointRequestWithAgent) => {
  return {
    organizationMembership: request.organizationMembership,
    projectMembership: request.projectMembership,
    project: request.project,
    agent: request.agent,
    agentMembership: request.agentMembership,
  }
}

export function toProjectDto(project: Project): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    organizationId: project.organizationId,
    createdAt: project.createdAt.getTime() as TimeType,
    updatedAt: project.updatedAt.getTime() as TimeType,
    featureFlags: toFeatureFlagsDto(project.featureFlags),
    agentSessionCategories: (project.projectAgentSessionCategories ?? []).map(
      toProjectAgentSessionCategoryDto,
    ),
  }
}

function toProjectAgentSessionCategoryDto(projectAgentSessionCategory: {
  id: string
  name: string
}): ProjectAgentSessionCategoryDto {
  return {
    id: projectAgentSessionCategory.id,
    name: projectAgentSessionCategory.name,
  }
}

function toFeatureFlagsDto(featureFlags: FeatureFlag[]): FeatureFlagsDto {
  return (
    featureFlags
      ?.filter((flag) => flag.enabled)
      .map((flag) => flag.featureFlagKey as FeatureFlagKey) ?? []
  )
}
