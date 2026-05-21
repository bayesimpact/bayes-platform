import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Organization } from "@/common/features/organizations/organizations.models"
import type { Project, ProjectAgentCategory } from "./projects.models"

type ProjectTransientParams = {
  organization: Organization
}

class ProjectFactory extends Factory<Project, ProjectTransientParams> {}

export const projectFactory = ProjectFactory.define(({ params, transientParams }) => {
  const { organization } = transientParams

  if (!organization) {
    throw new Error("Organization is required to create a project")
  }

  return {
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? faker.commerce.productName(),
    organizationId: organization.id,
    createdAt: params.createdAt ?? faker.date.past().getTime(),
    updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    featureFlags: params.featureFlags ?? [],
    agentCategories: params.agentCategories ?? [],
  }
})

const AGENT_CATEGORY_NAMES = ["Billing", "Support", "Onboarding", "Sales", "Operations", "Research"]

class ProjectAgentCategoryFactory extends Factory<ProjectAgentCategory> {}

export const projectAgentCategoryFactory = ProjectAgentCategoryFactory.define(({ params }) => ({
  id: params.id ?? faker.string.uuid(),
  name: params.name ?? faker.helpers.arrayElement(AGENT_CATEGORY_NAMES),
}))
