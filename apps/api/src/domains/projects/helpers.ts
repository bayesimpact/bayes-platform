import {
  type FeatureFlagKey,
  type FeatureFlagsDto,
  isProjectPermission,
  type MyProjectDto,
  type ProjectAgentSessionCategoryDto,
  type ProjectDto,
  type TimeType,
} from "@caseai-connect/api-contracts"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import type { FeatureFlag } from "../feature-flags/feature-flag.entity"
import type { ProjectModel } from "./project.model"

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

export function toProjectDto(project: ProjectModel): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    organizationId: project.organizationId,
    createdAt: project.createdAt.getTime() as TimeType,
    updatedAt: project.updatedAt.getTime() as TimeType,
    featureFlags: project.featureFlags as FeatureFlagKey[],
    conversationRetentionDays: project.conversationRetentionDays,
    agentSessionCategories: project.agentSessionCategories.map(toProjectAgentSessionCategoryDto),
    permissions: project.permissions.filter(isProjectPermission),
  }
}

export function toMyProjectDto(project: ProjectModel): MyProjectDto {
  return {
    id: project.id,
    name: project.name,
    organizationId: project.organizationId,
    featureFlags: project.featureFlags as FeatureFlagKey[],
    permissions: project.permissions,
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

function _toFeatureFlagsDto(featureFlags: FeatureFlag[]): FeatureFlagsDto {
  return (
    featureFlags
      ?.filter((flag) => flag.enabled)
      .map((flag) => flag.featureFlagKey as FeatureFlagKey) ?? []
  )
}
