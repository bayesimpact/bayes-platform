import type { TermsDocumentType, TimeType } from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type {
  BackofficeOrganization,
  BackofficeProject,
  BackofficeUser,
  BackofficeUserOrganizationMembership,
  BackofficeUserProjectMembership,
  PaginatedBackofficeOrganizations,
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

class BackofficeOrganizationFactory extends Factory<BackofficeOrganization> {}

export const backofficeOrganizationFactory = BackofficeOrganizationFactory.define(({ params }) => ({
  id: params.id ?? faker.string.uuid(),
  name: params.name ?? faker.company.name(),
  createdAt: (params.createdAt ?? faker.date.past().getTime()) as TimeType,
  projects: params.projects ?? [],
}))

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

class BackofficeUserFactory extends Factory<BackofficeUser> {}

export const backofficeUserFactory = BackofficeUserFactory.define(({ params }) => {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  return {
    id: params.id ?? faker.string.uuid(),
    email: params.email ?? faker.internet.email({ firstName, lastName }).toLowerCase(),
    name: params.name ?? `${firstName} ${lastName}`,
    createdAt: (params.createdAt ?? faker.date.past().getTime()) as TimeType,
    organizationMemberships: params.organizationMemberships ?? [],
    projectMemberships: params.projectMemberships ?? [],
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
