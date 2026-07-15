import type {
  AgentMembershipDto,
  OrganizationMembershipDto,
  ProjectMembershipDto,
  ReviewCampaignMembershipForMeDto,
} from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { OrganizationListItem } from "@/common/features/organizations/organizations.models"
import type { Project } from "@/common/features/projects/projects.models"
import type { User } from "./me.models"

type UserTransientParams = {
  organizationMemberships?: OrganizationMembershipDto[]
  projectMemberships?: ProjectMembershipDto[]
  agentMemberships?: AgentMembershipDto[]
  reviewCampaignMemberships?: ReviewCampaignMembershipForMeDto[]
}

class UserFactory extends Factory<User, UserTransientParams> {}

export const userFactory = UserFactory.define(({ params, transientParams }) => {
  const {
    organizationMemberships = [],
    projectMemberships = [],
    agentMemberships = [],
    reviewCampaignMemberships = [],
  } = transientParams

  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()

  return {
    id: params.id ?? faker.string.uuid(),
    email: params.email ?? faker.internet.email({ firstName, lastName }).toLowerCase(),
    name: params.name ?? `${firstName} ${lastName}`,
    globalPermissions: params.globalPermissions ?? [],
    isBackofficeAuthorized: params.isBackofficeAuthorized ?? false,
    isTermsManagementAuthorized: params.isTermsManagementAuthorized ?? false,
    termsAccepted: params.termsAccepted ?? true,
    memberships: {
      organizationMemberships,
      projectMemberships,
      agentMemberships,
      reviewCampaignMemberships,
      ...params.memberships,
    },
  } satisfies User
})

type OrganizationMembershipTransientParams = {
  organization: OrganizationListItem
  user?: User
}

class OrganizationMembershipFactory extends Factory<
  OrganizationMembershipDto,
  OrganizationMembershipTransientParams
> {}

export const organizationMembershipFactory = OrganizationMembershipFactory.define(
  ({ params, transientParams }) => {
    const { organization, user } = transientParams
    if (!organization) {
      throw new Error(
        "Organization must be provided in transient params to build an OrganizationMembership",
      )
    }
    return {
      id: params.id ?? faker.string.uuid(),
      organizationId: organization.id,
      userId: params.userId ?? user?.id ?? faker.string.uuid(),
      role: params.role ?? "member",
    } satisfies OrganizationMembershipDto
  },
)

type ProjectMembershipTransientParams = {
  project: Project
  user?: User
}

class ProjectMembershipFactory extends Factory<
  ProjectMembershipDto,
  ProjectMembershipTransientParams
> {}

export const projectMembershipFactory = ProjectMembershipFactory.define(
  ({ params, transientParams }) => {
    const { project, user } = transientParams
    if (!project) {
      throw new Error("Project must be provided in transient params to build a ProjectMembership")
    }
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    return {
      id: params.id ?? faker.string.uuid(),
      projectId: project.id,
      userId: params.userId ?? user?.id ?? faker.string.uuid(),
      userName: params.userName ?? user?.name ?? `${firstName} ${lastName}`,
      userEmail:
        params.userEmail ??
        user?.email ??
        faker.internet.email({ firstName, lastName }).toLowerCase(),
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      role: params.role ?? "member",
    } satisfies ProjectMembershipDto
  },
)

type AgentMembershipTransientParams = {
  agent: Agent
  user?: User
}

class AgentMembershipFactory extends Factory<AgentMembershipDto, AgentMembershipTransientParams> {}

export const agentMembershipFactory = AgentMembershipFactory.define(
  ({ params, transientParams }) => {
    const { agent, user } = transientParams
    if (!agent) {
      throw new Error("Agent must be provided in transient params to build an AgentMembership")
    }
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    return {
      id: params.id ?? faker.string.uuid(),
      agentId: agent.id,
      userId: params.userId ?? user?.id ?? faker.string.uuid(),
      userName: params.userName ?? user?.name ?? `${firstName} ${lastName}`,
      userEmail:
        params.userEmail ??
        user?.email ??
        faker.internet.email({ firstName, lastName }).toLowerCase(),
      role: params.role ?? "member",
      createdAt: params.createdAt ?? faker.date.past().getTime(),
    } satisfies AgentMembershipDto
  },
)

type ReviewCampaignMembershipTransientParams = {
  project: Project
}

class ReviewCampaignMembershipFactory extends Factory<
  ReviewCampaignMembershipForMeDto,
  ReviewCampaignMembershipTransientParams
> {}

export const reviewCampaignMembershipFactory = ReviewCampaignMembershipFactory.define(
  ({ params, transientParams }) => {
    const { project } = transientParams
    if (!project) {
      throw new Error(
        "Project must be provided in transient params to build a ReviewCampaignMembership",
      )
    }
    return {
      id: params.id ?? faker.string.uuid(),
      campaignId: params.campaignId ?? faker.string.uuid(),
      organizationId: project.organizationId,
      projectId: project.id,
      role: params.role ?? "reviewer",
      campaignStatus: params.campaignStatus ?? "active",
    } satisfies ReviewCampaignMembershipForMeDto
  },
)
