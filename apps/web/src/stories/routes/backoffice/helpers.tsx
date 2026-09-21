import {
  backofficeAgentDetailFactory,
  backofficeAgentListItemFactory,
  backofficeOrganizationDetailFactory,
  backofficeOrganizationFactory,
  backofficeProjectDetailFactory,
  backofficeProjectListItemFactory,
  backofficeRbacCatalogFactory,
  backofficeUserAgentMembershipFactory,
  backofficeUserDetailFactory,
  backofficeUserFactory,
  backofficeUserGlobalRoleFactory,
  backofficeUserOrganizationMembershipFactory,
  backofficeUserProjectMembershipFactory,
  backofficeUserReviewCampaignMembershipFactory,
  paginatedBackofficeAgentsFactory,
  paginatedBackofficeOrganizationsFactory,
  paginatedBackofficeProjectsFactory,
  paginatedBackofficeUsersFactory,
  termsDocumentsFactory,
} from "@/backoffice/features/backoffice/backoffice.factory"
import type {
  BackofficeAgentDetail,
  BackofficeAgentListItem,
  BackofficeOrganization,
  BackofficeOrganizationDetail,
  BackofficeProjectDetail,
  BackofficeProjectListItem,
  BackofficeRbacCatalog,
  BackofficeUser,
  BackofficeUserDetail,
  PaginatedBackofficeAgents,
  PaginatedBackofficeOrganizations,
  PaginatedBackofficeProjects,
  PaginatedBackofficeUsers,
  TermsDocuments,
} from "@/backoffice/features/backoffice/backoffice.models"
import type { IBackofficeSpi } from "@/backoffice/features/backoffice/backoffice.spi"
import { userFactory } from "@/common/features/me/me.factory"
import type { User } from "@/common/features/me/me.models"
import type { StoryPreloadedState } from "@/stories/decorators"
import { mergeSeeds, seed } from "@/stories/seed"

export type BackofficeStoryArgs = {
  isBackofficeAuthorized: boolean
  isTermsManagementAuthorized: boolean
  withOrganizations: boolean
  withAgents: boolean
  withProjects: boolean
  withUsers: boolean
  withTermsDocuments: boolean
}

export const backofficeStoryArgs = {
  isBackofficeAuthorized: true,
  isTermsManagementAuthorized: false,
  withOrganizations: true,
  withAgents: true,
  withProjects: true,
  withUsers: true,
  withTermsDocuments: false,
} satisfies BackofficeStoryArgs

export const backofficeStoryArgTypes = {
  isBackofficeAuthorized: { control: "boolean" },
  isTermsManagementAuthorized: { control: "boolean" },
  withOrganizations: { control: "boolean" },
  withAgents: { control: "boolean" },
  withProjects: { control: "boolean" },
  withUsers: { control: "boolean" },
  withTermsDocuments: { control: "boolean" },
} as const

export function buildBackofficeData(args: BackofficeStoryArgs): {
  user: User
  organizations: PaginatedBackofficeOrganizations
  agents: PaginatedBackofficeAgents
  projects: PaginatedBackofficeProjects
  users: PaginatedBackofficeUsers
  termsDocuments: TermsDocuments | null
  baseSeeds: StoryPreloadedState
} {
  const user = userFactory.build({
    globalPermissions: [
      ...(args.isBackofficeAuthorized ? (["backoffice.read"] as const) : []),
      ...(args.isTermsManagementAuthorized ? (["backoffice.terms.update"] as const) : []),
    ],
  })

  const organizations: PaginatedBackofficeOrganizations = args.withOrganizations
    ? buildOrganizationsPage()
    : paginatedBackofficeOrganizationsFactory.build({
        organizations: [],
        total: 0,
        page: 0,
        limit: 10,
      })
  const agents: PaginatedBackofficeAgents = args.withAgents
    ? buildAgentsPage()
    : paginatedBackofficeAgentsFactory.build({ agents: [], total: 0, page: 0, limit: 10 })
  const projects: PaginatedBackofficeProjects = args.withProjects
    ? buildProjectsPage()
    : paginatedBackofficeProjectsFactory.build({ projects: [], total: 0, page: 0, limit: 10 })
  const users: PaginatedBackofficeUsers = args.withUsers
    ? buildUsersPage()
    : paginatedBackofficeUsersFactory.build({ users: [], total: 0, page: 0, limit: 10 })
  const termsDocuments =
    args.isTermsManagementAuthorized && args.withTermsDocuments
      ? termsDocumentsFactory.build()
      : null

  const seeds: StoryPreloadedState[] = [seed.me(user), seed.backoffice.organizations(organizations)]
  seeds.push(seed.backoffice.agents(agents))
  seeds.push(seed.backoffice.projects(projects))
  seeds.push(seed.backoffice.users(users))
  if (termsDocuments) seeds.push(seed.backoffice.termsDocuments(termsDocuments))

  return {
    user,
    organizations,
    agents,
    projects,
    users,
    termsDocuments,
    baseSeeds: mergeSeeds(...seeds),
  }
}

function buildOrganizationsPage(): PaginatedBackofficeOrganizations {
  const organizations: BackofficeOrganization[] = backofficeOrganizationFactory.buildList(3)
  return paginatedBackofficeOrganizationsFactory.build({
    organizations,
    total: organizations.length,
    page: 0,
    limit: 10,
  })
}

function buildAgentsPage(): PaginatedBackofficeAgents {
  const total = 12
  const pageSize = 10
  const agents: BackofficeAgentListItem[] = backofficeAgentListItemFactory.buildList(pageSize)
  return paginatedBackofficeAgentsFactory.build({ agents, total, page: 0, limit: pageSize })
}

function buildProjectsPage(): PaginatedBackofficeProjects {
  const total = 18
  const pageSize = 10
  const projects: BackofficeProjectListItem[] = backofficeProjectListItemFactory.buildList(pageSize)
  return paginatedBackofficeProjectsFactory.build({ projects, total, page: 0, limit: pageSize })
}

function buildUsersPage(): PaginatedBackofficeUsers {
  const total = 24
  const pageSize = 10
  const users: BackofficeUser[] = backofficeUserFactory.buildList(pageSize)
  return paginatedBackofficeUsersFactory.build({ users, total, page: 0, limit: pageSize })
}

export function buildMockBackofficeService(overrides: {
  organizations?: PaginatedBackofficeOrganizations
  organizationDetails?: Record<string, BackofficeOrganizationDetail>
  agents?: PaginatedBackofficeAgents
  agentDetails?: Record<string, BackofficeAgentDetail>
  projects?: PaginatedBackofficeProjects
  projectDetails?: Record<string, BackofficeProjectDetail>
  users?: PaginatedBackofficeUsers
  userDetails?: Record<string, BackofficeUserDetail>
  rbacCatalog?: BackofficeRbacCatalog | null
  termsDocuments?: TermsDocuments | null
}): IBackofficeSpi {
  const organizations =
    overrides.organizations ??
    paginatedBackofficeOrganizationsFactory.build({
      organizations: [],
      total: 0,
      page: 0,
      limit: 10,
    })
  const organizationDetails = overrides.organizationDetails ?? {}
  const agents =
    overrides.agents ??
    paginatedBackofficeAgentsFactory.build({ agents: [], total: 0, page: 0, limit: 10 })
  const agentDetails = overrides.agentDetails ?? {}
  const projects =
    overrides.projects ??
    paginatedBackofficeProjectsFactory.build({ projects: [], total: 0, page: 0, limit: 10 })
  const projectDetails = overrides.projectDetails ?? {}
  const users =
    overrides.users ??
    paginatedBackofficeUsersFactory.build({ users: [], total: 0, page: 0, limit: 10 })
  const userDetails = overrides.userDetails ?? {}
  const rbacCatalog = overrides.rbacCatalog ?? null
  const termsDocuments = overrides.termsDocuments ?? null
  return {
    async listOrganizations() {
      return organizations
    },
    async createOrganization({ name }) {
      return backofficeOrganizationFactory.build({ name })
    },
    async getOrganization(organizationId) {
      const detail = organizationDetails[organizationId]
      if (!detail) {
        return backofficeOrganizationDetailFactory.build({ id: organizationId })
      }
      return detail
    },
    async listAgents() {
      return agents
    },
    async getAgent(agentId) {
      const detail = agentDetails[agentId]
      if (!detail) {
        return backofficeAgentDetailFactory.build({ id: agentId })
      }
      return detail
    },
    async listProjects() {
      return projects
    },
    async getProject(projectId) {
      const detail = projectDetails[projectId]
      if (!detail) {
        return backofficeProjectDetailFactory.build({ id: projectId })
      }
      return detail
    },
    async listUsers() {
      return users
    },
    async getUser(userId) {
      const detail = userDetails[userId]
      if (!detail) {
        return backofficeUserDetailFactory.build({ id: userId })
      }
      return detail
    },
    async getRbacCatalog() {
      if (!rbacCatalog) return backofficeRbacCatalogFactory.build()
      return rbacCatalog
    },
    async addFeatureFlag() {},
    async removeFeatureFlag() {},
    async listTermsDocuments() {
      if (!termsDocuments) throw new Error("No terms documents seeded in mock service")
      return termsDocuments
    },
    async updateTermsDocuments() {
      if (!termsDocuments) throw new Error("No terms documents seeded in mock service")
      return termsDocuments
    },
  }
}

export const BACKOFFICE_STORY_USER_ID = "b8a70b5a-e63a-46f9-9699-fd51dab6f24a"

export function buildInspectorUserDetail(): BackofficeUserDetail {
  const organization = backofficeOrganizationFactory.build({ name: "Acme Corp" })
  const project = backofficeProjectListItemFactory.build({
    name: "Sample project",
    organizationId: organization.id,
    organizationName: organization.name,
  })
  return backofficeUserDetailFactory.build({
    id: BACKOFFICE_STORY_USER_ID,
    email: "didier@example.com",
    name: "Didier",
    globalRoles: [
      backofficeUserGlobalRoleFactory.build({
        key: "platform_superadmin",
        name: "Platform Superadmin",
        permissions: [
          "app.install",
          "backoffice.app.manage",
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
      }),
    ],
    organizationMemberships: [
      backofficeUserOrganizationMembershipFactory.transient({ organization }).build({
        role: "owner",
        roleKey: "org_owner",
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
      }),
    ],
    projectMemberships: [
      backofficeUserProjectMembershipFactory
        .transient({
          project: {
            id: project.id,
            name: project.name,
            organizationId: project.organizationId,
            createdAt: project.createdAt,
            updatedAt: project.createdAt,
            featureFlags: project.featureFlags,
          },
        })
        .build({
          role: "owner",
          roleKey: "project_owner",
          permissions: [
            "project.read",
            "project.update",
            "project.delete",
            "agent.create",
            "agent.read",
            "document.read",
            "document.create",
            "document.update",
            "document.delete",
            "user.read",
            "backoffice.project.read",
            "backoffice.project.update",
            "backoffice.agent.read",
          ],
        }),
    ],
    agentMemberships: [
      backofficeUserAgentMembershipFactory.build({
        agentName: "Helpful Assistant",
        role: "owner",
        roleKey: "agent_owner",
        permissions: [
          "agent.read",
          "agent.update",
          "agent.delete",
          "user.read",
          "backoffice.agent.read",
        ],
      }),
      backofficeUserAgentMembershipFactory.build({
        agentName: "Support Agent",
        role: "admin",
        roleKey: "agent_admin",
        permissions: [
          "agent.read",
          "agent.update",
          "agent.delete",
          "user.read",
          "backoffice.agent.read",
        ],
      }),
    ],
    reviewCampaignMemberships: [
      backofficeUserReviewCampaignMembershipFactory.build({ role: "reviewer" }),
    ],
  })
}
