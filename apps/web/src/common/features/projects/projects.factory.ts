import type { ProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Organization } from "@/common/features/organizations/organizations.models"
import type {
  MyProject,
  Project,
  ProjectAgentSessionCategory,
  RetentionSweepRun,
} from "./projects.models"

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
    conversationRetentionDays: params.conversationRetentionDays ?? 30,
    agentSessionCategories: params.agentSessionCategories ?? [],
    permissions: params.permissions ?? [],
  }
})

type MyProjectTransientParams = {
  organization: Organization
  role: ProjectMembershipRoleDto
}

const MEMBER_PERMISSIONS = ["project.read", "desk.ui.read"]

const ADMIN_PERMISSIONS = [...MEMBER_PERMISSIONS, "studio.ui.read", "evaluation.ui.read"]

function permissionsForRole(role: ProjectMembershipRoleDto): string[] {
  return role === "member" ? MEMBER_PERMISSIONS : ADMIN_PERMISSIONS
}

class MyProjectFactory extends Factory<MyProject, MyProjectTransientParams> {}

export const myProjectFactory = MyProjectFactory.define(({ params, transientParams }) => {
  const { organization, role } = transientParams

  if (!organization) {
    throw new Error("Organization is required to create a project")
  }

  return {
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? faker.commerce.productName(),
    organizationId: organization.id,
    featureFlags: params.featureFlags ?? [],
    permissions: params.permissions ?? permissionsForRole(role ?? "member"),
  }
})

const AGENT_SESSION_CATEGORY_NAMES = [
  "Billing",
  "Support",
  "Onboarding",
  "Sales",
  "Operations",
  "Research",
]

class ProjectAgentSessionCategoryFactory extends Factory<ProjectAgentSessionCategory> {}

export const projectAgentSessionCategoryFactory = ProjectAgentSessionCategoryFactory.define(
  ({ params }) => ({
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? faker.helpers.arrayElement(AGENT_SESSION_CATEGORY_NAMES),
  }),
)

class RetentionSweepRunFactory extends Factory<RetentionSweepRun> {}

export const retentionSweepRunFactory = RetentionSweepRunFactory.define(({ params, sequence }) => {
  const purgedCount = params.purgedCount ?? faker.number.int({ min: 0, max: 40 })
  return {
    id: params.id ?? faker.string.uuid(),
    ranAt: params.ranAt ?? faker.date.recent({ days: sequence }).getTime(),
    purgedCount,
    status: params.status ?? "OK",
    report: params.report ?? `- Conversations purged: ${purgedCount}\n- Embed sessions purged: 0`,
  }
})
