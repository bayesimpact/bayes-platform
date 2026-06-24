import type { TermsDocumentType, TimeType } from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type {
  BackofficeAgentDetail,
  BackofficeAgentListItem,
  BackofficeAgentMember,
  BackofficeOrganization,
  BackofficeOrganizationDetail,
  BackofficeOrganizationMember,
  BackofficeOrganizationProject,
  BackofficeProject,
  BackofficeProjectAgent,
  BackofficeProjectDetail,
  BackofficeProjectListItem,
  BackofficeProjectMember,
  BackofficeUser,
  BackofficeUserAgentMembership,
  BackofficeUserDetail,
  BackofficeUserOrganizationMembership,
  BackofficeUserProjectMembership,
  BackofficeUserReviewCampaignMembership,
  PaginatedBackofficeAgents,
  PaginatedBackofficeOrganizations,
  PaginatedBackofficeProjects,
  PaginatedBackofficeUsers,
  TermsDocuments,
} from "./backoffice.models"

type BackofficeProjectTransientParams = {
  organization: BackofficeOrganization
}

class BackofficeProjectFactory extends Factory<
  BackofficeProject,
  BackofficeProjectTransientParams
> {}

export const backofficeProjectFactory = BackofficeProjectFactory.define(
  ({ params, transientParams }) => {
    const { organization } = transientParams
    if (!organization) {
      throw new Error(
        "Organization must be provided in transient params to build a BackofficeProject",
      )
    }
    return {
      id: params.id ?? faker.string.uuid(),
      name: params.name ?? faker.commerce.productName(),
      organizationId: organization.id,
      createdAt: (params.createdAt ?? faker.date.past().getTime()) as TimeType,
      updatedAt: (params.updatedAt ?? faker.date.recent().getTime()) as TimeType,
      featureFlags: params.featureFlags ?? [],
    }
  },
)

class BackofficeAgentListItemFactory extends Factory<BackofficeAgentListItem> {}

export const backofficeAgentListItemFactory = BackofficeAgentListItemFactory.define(
  ({ params }) => ({
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? "Helpful Assistant",
    projectId: params.projectId ?? faker.string.uuid(),
    projectName: params.projectName ?? faker.commerce.productName(),
    createdAt: (params.createdAt ?? faker.date.past().getTime()) as TimeType,
  }),
)

class BackofficeAgentMemberFactory extends Factory<BackofficeAgentMember> {}

export const backofficeAgentMemberFactory = BackofficeAgentMemberFactory.define(({ params }) => ({
  userId: params.userId ?? faker.string.uuid(),
  userEmail: params.userEmail ?? faker.internet.email().toLowerCase(),
  userName: params.userName ?? faker.person.fullName(),
  role: params.role ?? "member",
}))

class BackofficeAgentDetailFactory extends Factory<BackofficeAgentDetail> {}

export const backofficeAgentDetailFactory = BackofficeAgentDetailFactory.define(({ params }) => ({
  id: params.id ?? faker.string.uuid(),
  name: params.name ?? "Helpful Assistant",
  projectId: params.projectId ?? faker.string.uuid(),
  projectName: params.projectName ?? faker.commerce.productName(),
  organizationId: params.organizationId ?? faker.string.uuid(),
  organizationName: params.organizationName ?? faker.company.name(),
  createdAt: (params.createdAt ?? faker.date.past().getTime()) as TimeType,
  members: params.members ?? [],
}))

class PaginatedBackofficeAgentsFactory extends Factory<PaginatedBackofficeAgents> {}

export const paginatedBackofficeAgentsFactory = PaginatedBackofficeAgentsFactory.define(
  ({ params }) => {
    const agents = params.agents ?? []
    return {
      agents,
      total: params.total ?? agents.length,
      page: params.page ?? 0,
      limit: params.limit ?? 10,
    }
  },
)

class BackofficeProjectListItemFactory extends Factory<BackofficeProjectListItem> {}

export const backofficeProjectListItemFactory = BackofficeProjectListItemFactory.define(
  ({ params }) => ({
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? faker.commerce.productName(),
    organizationId: params.organizationId ?? faker.string.uuid(),
    organizationName: params.organizationName ?? faker.company.name(),
    createdAt: (params.createdAt ?? faker.date.past().getTime()) as TimeType,
    featureFlags: params.featureFlags ?? [],
  }),
)

class BackofficeProjectMemberFactory extends Factory<BackofficeProjectMember> {}

export const backofficeProjectMemberFactory = BackofficeProjectMemberFactory.define(
  ({ params }) => ({
    userId: params.userId ?? faker.string.uuid(),
    userEmail: params.userEmail ?? faker.internet.email().toLowerCase(),
    userName: params.userName ?? faker.person.fullName(),
    role: params.role ?? "member",
  }),
)

class BackofficeProjectAgentFactory extends Factory<BackofficeProjectAgent> {}

export const backofficeProjectAgentFactory = BackofficeProjectAgentFactory.define(({ params }) => ({
  id: params.id ?? faker.string.uuid(),
  name: params.name ?? "Helpful Assistant",
}))

class BackofficeProjectDetailFactory extends Factory<BackofficeProjectDetail> {}

export const backofficeProjectDetailFactory = BackofficeProjectDetailFactory.define(
  ({ params }) => ({
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? faker.commerce.productName(),
    organizationId: params.organizationId ?? faker.string.uuid(),
    organizationName: params.organizationName ?? faker.company.name(),
    createdAt: (params.createdAt ?? faker.date.past().getTime()) as TimeType,
    featureFlags: params.featureFlags ?? [],
    members: params.members ?? [],
    agents: params.agents ?? [],
  }),
)

class PaginatedBackofficeProjectsFactory extends Factory<PaginatedBackofficeProjects> {}

export const paginatedBackofficeProjectsFactory = PaginatedBackofficeProjectsFactory.define(
  ({ params }) => {
    const projects = params.projects ?? []
    return {
      projects,
      total: params.total ?? projects.length,
      page: params.page ?? 0,
      limit: params.limit ?? 10,
    }
  },
)

class BackofficeOrganizationFactory extends Factory<BackofficeOrganization> {}

export const backofficeOrganizationFactory = BackofficeOrganizationFactory.define(({ params }) => ({
  id: params.id ?? faker.string.uuid(),
  name: params.name ?? faker.company.name(),
  createdAt: (params.createdAt ?? faker.date.past().getTime()) as TimeType,
}))

class BackofficeOrganizationMemberFactory extends Factory<BackofficeOrganizationMember> {}

export const backofficeOrganizationMemberFactory = BackofficeOrganizationMemberFactory.define(
  ({ params }) => ({
    userId: params.userId ?? faker.string.uuid(),
    userEmail: params.userEmail ?? faker.internet.email().toLowerCase(),
    userName: params.userName ?? faker.person.fullName(),
    role: params.role ?? "member",
  }),
)

class BackofficeOrganizationProjectFactory extends Factory<BackofficeOrganizationProject> {}

export const backofficeOrganizationProjectFactory = BackofficeOrganizationProjectFactory.define(
  ({ params }) => ({
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? faker.commerce.productName(),
    featureFlags: params.featureFlags ?? [],
  }),
)

class BackofficeOrganizationDetailFactory extends Factory<BackofficeOrganizationDetail> {}

export const backofficeOrganizationDetailFactory = BackofficeOrganizationDetailFactory.define(
  ({ params }) => ({
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? faker.company.name(),
    createdAt: (params.createdAt ?? faker.date.past().getTime()) as TimeType,
    members: params.members ?? [],
    projects: params.projects ?? [],
  }),
)

class BackofficeUserFactory extends Factory<BackofficeUser> {}

export const backofficeUserFactory = BackofficeUserFactory.define(({ params }) => {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  return {
    id: params.id ?? faker.string.uuid(),
    email: params.email ?? faker.internet.email({ firstName, lastName }).toLowerCase(),
    name: params.name ?? `${firstName} ${lastName}`,
    createdAt: (params.createdAt ?? faker.date.past().getTime()) as TimeType,
  }
})

class PaginatedBackofficeUsersFactory extends Factory<PaginatedBackofficeUsers> {}

export const paginatedBackofficeUsersFactory = PaginatedBackofficeUsersFactory.define(
  ({ params }) => {
    const users = params.users ?? []
    return {
      users,
      total: params.total ?? users.length,
      page: params.page ?? 0,
      limit: params.limit ?? 10,
    }
  },
)

class PaginatedBackofficeOrganizationsFactory extends Factory<PaginatedBackofficeOrganizations> {}

export const paginatedBackofficeOrganizationsFactory =
  PaginatedBackofficeOrganizationsFactory.define(({ params }) => {
    const organizations = params.organizations ?? []
    return {
      organizations,
      total: params.total ?? organizations.length,
      page: params.page ?? 0,
      limit: params.limit ?? 10,
    }
  })

type OrganizationMembershipTransientParams = {
  organization: BackofficeOrganization
}

class BackofficeUserOrganizationMembershipFactory extends Factory<
  BackofficeUserOrganizationMembership,
  OrganizationMembershipTransientParams
> {}

export const backofficeUserOrganizationMembershipFactory =
  BackofficeUserOrganizationMembershipFactory.define(({ params, transientParams }) => {
    const { organization } = transientParams
    if (!organization) {
      throw new Error(
        "Organization must be provided in transient params to build a BackofficeUserOrganizationMembership",
      )
    }
    return {
      organizationId: params.organizationId ?? organization.id,
      organizationName: params.organizationName ?? organization.name,
      role: params.role ?? "member",
    }
  })

type ProjectMembershipTransientParams = {
  project: BackofficeProject
}

class BackofficeUserProjectMembershipFactory extends Factory<
  BackofficeUserProjectMembership,
  ProjectMembershipTransientParams
> {}

export const backofficeUserProjectMembershipFactory = BackofficeUserProjectMembershipFactory.define(
  ({ params, transientParams }) => {
    const { project } = transientParams
    if (!project) {
      throw new Error(
        "Project must be provided in transient params to build a BackofficeUserProjectMembership",
      )
    }
    return {
      projectId: params.projectId ?? project.id,
      projectName: params.projectName ?? project.name,
      role: params.role ?? "member",
    }
  },
)

class BackofficeUserAgentMembershipFactory extends Factory<BackofficeUserAgentMembership> {}

export const backofficeUserAgentMembershipFactory = BackofficeUserAgentMembershipFactory.define(
  ({ params }) => ({
    agentId: params.agentId ?? faker.string.uuid(),
    agentName: params.agentName ?? faker.commerce.productName(),
    role: params.role ?? "member",
  }),
)

class BackofficeUserReviewCampaignMembershipFactory extends Factory<BackofficeUserReviewCampaignMembership> {}

export const backofficeUserReviewCampaignMembershipFactory =
  BackofficeUserReviewCampaignMembershipFactory.define(({ params }) => ({
    campaignId: params.campaignId ?? faker.string.uuid(),
    campaignName: params.campaignName ?? faker.lorem.words({ min: 2, max: 4 }),
    role: params.role ?? "tester",
  }))

class BackofficeUserDetailFactory extends Factory<BackofficeUserDetail> {}

export const backofficeUserDetailFactory = BackofficeUserDetailFactory.define(({ params }) => {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  return {
    id: params.id ?? faker.string.uuid(),
    email: params.email ?? faker.internet.email({ firstName, lastName }).toLowerCase(),
    name: params.name ?? `${firstName} ${lastName}`,
    createdAt: (params.createdAt ?? faker.date.past().getTime()) as TimeType,
    organizationMemberships: params.organizationMemberships ?? [],
    projectMemberships: params.projectMemberships ?? [],
    agentMemberships: params.agentMemberships ?? [],
    reviewCampaignMemberships: params.reviewCampaignMemberships ?? [],
  }
})

function termsDocument(type: TermsDocumentType) {
  return {
    type,
    url: faker.internet.url(),
    version: faker.number.int({ min: 1, max: 10 }),
    updatedAt: faker.date.recent().getTime() as TimeType,
  }
}

class TermsDocumentsFactory extends Factory<TermsDocuments> {}

export const termsDocumentsFactory = TermsDocumentsFactory.define(({ params }) => ({
  generalConditions: { ...termsDocument("general_conditions"), ...params.generalConditions },
  privacyPolicy: { ...termsDocument("privacy_policy"), ...params.privacyPolicy },
  aiUsagePolicy: { ...termsDocument("ai_usage_policy"), ...params.aiUsagePolicy },
}))
