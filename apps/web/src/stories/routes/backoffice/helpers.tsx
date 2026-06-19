import {
  backofficeAgentDetailFactory,
  backofficeAgentListItemFactory,
  backofficeOrganizationDetailFactory,
  backofficeOrganizationFactory,
  backofficeProjectDetailFactory,
  backofficeProjectListItemFactory,
  backofficeUserFactory,
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
  BackofficeUser,
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
    isBackofficeAuthorized: args.isBackofficeAuthorized,
    isTermsManagementAuthorized: args.isTermsManagementAuthorized,
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
  const termsDocuments = overrides.termsDocuments ?? null
  return {
    async listOrganizations() {
      return organizations
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
      throw new Error(`getUser(${userId}) not implemented in mock service`)
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
