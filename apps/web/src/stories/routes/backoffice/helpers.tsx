import {
  backofficeOrganizationFactory,
  backofficeProjectFactory,
  backofficeUserFactory,
  backofficeUserOrganizationMembershipFactory,
  backofficeUserProjectMembershipFactory,
  paginatedBackofficeOrganizationsFactory,
  paginatedBackofficeUsersFactory,
  termsDocumentsFactory,
} from "@/backoffice/features/backoffice/backoffice.factory"
import type {
  BackofficeOrganization,
  BackofficeUser,
  PaginatedBackofficeOrganizations,
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
  withUsers: boolean
  withTermsDocuments: boolean
}

export const backofficeStoryArgs = {
  isBackofficeAuthorized: true,
  isTermsManagementAuthorized: false,
  withOrganizations: true,
  withUsers: true,
  withTermsDocuments: false,
} satisfies BackofficeStoryArgs

export const backofficeStoryArgTypes = {
  isBackofficeAuthorized: { control: "boolean" },
  isTermsManagementAuthorized: { control: "boolean" },
  withOrganizations: { control: "boolean" },
  withUsers: { control: "boolean" },
  withTermsDocuments: { control: "boolean" },
} as const

export function buildBackofficeData(args: BackofficeStoryArgs): {
  user: User
  organizations: PaginatedBackofficeOrganizations
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
  const users: PaginatedBackofficeUsers = args.withUsers
    ? buildUsersPage(organizations.organizations)
    : paginatedBackofficeUsersFactory.build({ users: [], total: 0, page: 0, limit: 10 })
  const termsDocuments =
    args.isTermsManagementAuthorized && args.withTermsDocuments
      ? termsDocumentsFactory.build()
      : null

  const seeds: StoryPreloadedState[] = [seed.me(user), seed.backoffice.organizations(organizations)]
  seeds.push(seed.backoffice.users(users))
  if (termsDocuments) seeds.push(seed.backoffice.termsDocuments(termsDocuments))

  return {
    user,
    organizations,
    users,
    termsDocuments,
    baseSeeds: mergeSeeds(...seeds),
  }
}

function buildOrganizationsPage(): PaginatedBackofficeOrganizations {
  const organizations: BackofficeOrganization[] = Array.from({ length: 3 }).map(() => {
    const organization = backofficeOrganizationFactory.build()
    const projects = backofficeProjectFactory.transient({ organization }).buildList(2)
    return { ...organization, projects }
  })
  return paginatedBackofficeOrganizationsFactory.build({
    organizations,
    total: organizations.length,
    page: 0,
    limit: 10,
  })
}

function buildUsersPage(organizations: BackofficeOrganization[]): PaginatedBackofficeUsers {
  const total = 24
  const pageSize = 10
  const users: BackofficeUser[] = Array.from({ length: pageSize }).map(() => {
    const organization = organizations[0]
    const project = organization?.projects[0]
    const organizationMemberships = organization
      ? [backofficeUserOrganizationMembershipFactory.transient({ organization }).build()]
      : []
    const projectMemberships = project
      ? [backofficeUserProjectMembershipFactory.transient({ project }).build()]
      : []
    return backofficeUserFactory.build({
      organizationMemberships,
      projectMemberships,
    })
  })
  return paginatedBackofficeUsersFactory.build({ users, total, page: 0, limit: pageSize })
}

export function buildMockBackofficeService(overrides: {
  organizations?: PaginatedBackofficeOrganizations
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
  const users =
    overrides.users ??
    paginatedBackofficeUsersFactory.build({ users: [], total: 0, page: 0, limit: 10 })
  const termsDocuments = overrides.termsDocuments ?? null
  return {
    async listOrganizations() {
      return organizations
    },
    async listUsers() {
      return users
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
