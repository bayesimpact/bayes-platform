import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "./project.entity"

type ProjectTransientParams = {
  organization: Organization
}

class ProjectFactory extends Factory<Project, ProjectTransientParams> {}

export const projectFactory = ProjectFactory.define(({ sequence, params, transientParams }) => {
  if (!transientParams.organization) {
    throw new Error("organization transient is required")
  }

  const now = new Date()
  return {
    id: params.id || randomUUID(),
    name: params.name || `Test Project ${sequence}`,
    organizationId: transientParams.organization.id,
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    deletedAt: null,
    organization: transientParams.organization,
    agents: params.agents || [],
    documents: params.documents || [],
    agentMessageFeedbacks: params.agentMessageFeedbacks || [],
    evaluations: params.evaluations || [],
    featureFlags: params.featureFlags || [],
    projectAgentSessionCategories: params.projectAgentSessionCategories || [],
    reviewCampaigns: params.reviewCampaigns || [],
  } satisfies Project
})
