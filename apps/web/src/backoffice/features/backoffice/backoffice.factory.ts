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
  BackofficeRbacCatalog,
  BackofficeUser,
  BackofficeUserAgentMembership,
  BackofficeUserDetail,
  BackofficeUserGlobalRole,
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
      roleKey: params.roleKey ?? "org_member",
      permissions: params.permissions ?? ["organization.read"],
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
      roleKey: params.roleKey ?? "project_member",
      permissions: params.permissions ?? ["project.read"],
    }
  },
)

class BackofficeUserAgentMembershipFactory extends Factory<BackofficeUserAgentMembership> {}

export const backofficeUserAgentMembershipFactory = BackofficeUserAgentMembershipFactory.define(
  ({ params }) => ({
    agentId: params.agentId ?? faker.string.uuid(),
    agentName: params.agentName ?? faker.commerce.productName(),
    role: params.role ?? "member",
    roleKey: params.roleKey ?? "agent_member",
    permissions: params.permissions ?? ["agent.read"],
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
    globalRoles: params.globalRoles ?? [],
    organizationMemberships: params.organizationMemberships ?? [],
    projectMemberships: params.projectMemberships ?? [],
    agentMemberships: params.agentMemberships ?? [],
    reviewCampaignMemberships: params.reviewCampaignMemberships ?? [],
  }
})

class BackofficeUserGlobalRoleFactory extends Factory<BackofficeUserGlobalRole> {}

export const backofficeUserGlobalRoleFactory = BackofficeUserGlobalRoleFactory.define(
  ({ params }) => ({
    key: params.key ?? "platform_staff",
    name: params.name ?? "Platform Staff",
    permissions: params.permissions ?? ["backoffice.read", "trace.read"],
  }),
)

class BackofficeRbacCatalogFactory extends Factory<BackofficeRbacCatalog> {}

export const backofficeRbacCatalogFactory = BackofficeRbacCatalogFactory.define(({ params }) => ({
  roles: params.roles ?? [
    {
      key: "platform_staff",
      name: "Platform Staff",
      scopeType: "global" as const,
      permissions: ["backoffice.read", "trace.read"],
    },
    {
      key: "platform_superadmin",
      name: "Platform Superadmin",
      scopeType: "global" as const,
      permissions: [
        "backoffice.read",
        "trace.read",
        "backoffice.terms.update",
        "backoffice.organization.read",
        "backoffice.project.read",
        "backoffice.project.update",
        "backoffice.agent.read",
        "backoffice.user.read",
        "organization.create",
      ],
    },
    {
      key: "org_owner",
      name: "Organization Owner",
      scopeType: "organization" as const,
      permissions: [
        "organization.read",
        "organization.update",
        "organization.delete",
        "project.create",
        "user.read",
        "backoffice.organization.read",
        "backoffice.project.read",
        "backoffice.agent.read",
      ],
    },
    {
      key: "org_admin",
      name: "Organization Admin",
      scopeType: "organization" as const,
      permissions: [
        "organization.read",
        "organization.update",
        "project.create",
        "user.read",
        "backoffice.organization.read",
        "backoffice.project.read",
        "backoffice.agent.read",
      ],
    },
    {
      key: "org_member",
      name: "Organization Member",
      scopeType: "organization" as const,
      permissions: ["organization.read"],
    },
    {
      key: "project_owner",
      name: "Project Owner",
      scopeType: "project" as const,
      permissions: [
        "project.read",
        "project.update",
        "project.delete",
        "agent.create",
        "agent.read",
        "user.read",
        "backoffice.project.read",
        "backoffice.project.update",
        "backoffice.agent.read",
      ],
    },
    {
      key: "project_admin",
      name: "Project Admin",
      scopeType: "project" as const,
      permissions: [
        "project.read",
        "project.update",
        "project.delete",
        "agent.create",
        "agent.read",
        "user.read",
        "backoffice.project.read",
        "backoffice.project.update",
        "backoffice.agent.read",
      ],
    },
    {
      key: "project_member",
      name: "Project Member",
      scopeType: "project" as const,
      permissions: ["project.read"],
    },
    {
      key: "agent_owner",
      name: "Agent Owner",
      scopeType: "agent" as const,
      permissions: [
        "agent.read",
        "agent.update",
        "agent.delete",
        "user.read",
        "backoffice.agent.read",
      ],
    },
    {
      key: "agent_admin",
      name: "Agent Admin",
      scopeType: "agent" as const,
      permissions: [
        "agent.read",
        "agent.update",
        "agent.delete",
        "user.read",
        "backoffice.agent.read",
      ],
    },
    {
      key: "agent_member",
      name: "Agent Member",
      scopeType: "agent" as const,
      permissions: ["agent.read"],
    },
  ],
  permissions: params.permissions ?? [
    { key: "agent.create", description: "Create agents in a project" },
    { key: "agent.delete", description: "Delete an agent" },
    { key: "agent.read", description: "See an agent" },
    { key: "agent.update", description: "Update an agent" },
    { key: "backoffice.agent.read", description: "See agents in the backoffice" },
    { key: "backoffice.organization.read", description: "See organizations in the backoffice" },
    { key: "backoffice.project.read", description: "See projects in the backoffice" },
    {
      key: "backoffice.project.update",
      description: "Mutate a project from the backoffice (e.g. feature flags)",
    },
    { key: "backoffice.read", description: "Access /backoffice routes" },
    { key: "backoffice.terms.update", description: "Manage terms documents" },
    { key: "backoffice.user.read", description: "See every user in the backoffice" },
    { key: "organization.create", description: "Create organizations" },
    { key: "organization.delete", description: "Delete an organization" },
    { key: "organization.read", description: "See an organization" },
    { key: "organization.update", description: "Update an organization" },
    { key: "project.create", description: "Create projects in an organization" },
    { key: "project.delete", description: "Delete a project" },
    { key: "project.read", description: "See a project" },
    { key: "project.update", description: "Update a project" },
    { key: "trace.read", description: "See Langfuse trace links" },
    { key: "user.read", description: "See the users who are members of a resource" },
  ],
}))

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
