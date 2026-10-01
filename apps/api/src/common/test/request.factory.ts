import { Factory } from "fishery"
import type {
  EndpointRequest,
  EndpointRequestWithAgent,
  EndpointRequestWithDocument,
  EndpointRequestWithOrganizationMembership,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import type { Document } from "@/domains/documents/document.entity"
import { organizationMembershipFactory } from "@/domains/organizations/memberships/organization-membership.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "@/domains/projects/project.entity"
import type { User } from "@/domains/users/user.entity"

type EndpointRequestTransientParams = {
  user: User
}

export const endpointRequestFactory = Factory.define<
  EndpointRequest,
  EndpointRequestTransientParams
>(({ transientParams }) => {
  const user = transientParams.user
  if (!user) {
    throw new Error("user transient is required")
  }
  return {
    user,
    jwtPayload: {
      sub: user.authSubject!,
      iss: "https://caseai.com",
      aud: ["https://caseai.com"],
      iat: Date.now(),
      exp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).getTime(),
      azp: "caseai",
      scope: "openid profile email",
    },
  } satisfies EndpointRequest
})

export const buildEndpointRequest = (user: User) => {
  return endpointRequestFactory.transient({ user }).build()
}

type EndpointRequestWithOrganizationTransientParams = {
  organization: Organization
  user: User
}

export const endpointRequestWithOrganizationFactory = Factory.define<
  EndpointRequestWithOrganizationMembership,
  EndpointRequestWithOrganizationTransientParams
>(({ transientParams }) => {
  const organization = transientParams.organization
  const user = transientParams.user
  const baseRequest = endpointRequestFactory.transient({ user }).build()

  if (!organization) {
    throw new Error("organization transient is required")
  }

  return {
    ...baseRequest,
    organizationId: organization.id,
    organizationMembership: organizationMembershipFactory.transient({ organization, user }).build(),
  } satisfies EndpointRequestWithOrganizationMembership
})

export const buildEndpointRequestWithOrganization = (organization: Organization, user: User) => {
  return endpointRequestWithOrganizationFactory
    .transient({ organization, user })
    .build() satisfies EndpointRequestWithOrganizationMembership
}

type EndpointRequestWithOrganizationAndProjectTransientParams = {
  organization: Organization
  user: User
  project: Project
}

type EndpointRequestWithOrganizationAndProjectAndDocumentTransientParams = {
  organization: Organization
  user: User
  project: Project
  document: Document
}

type EndpointRequestWithAgentTransientParams = {
  organization: Organization
  user: User
  project: Project
  agent: Agent
}

export const endpointRequestWithOrganizationAndProjectFactory = Factory.define<
  EndpointRequestWithProject,
  EndpointRequestWithOrganizationAndProjectTransientParams
>(({ transientParams }) => {
  const organization = transientParams.organization
  const user = transientParams.user
  const project = transientParams.project
  const baseRequest = endpointRequestWithOrganizationFactory
    .transient({ organization, user })
    .build()

  if (!project) {
    throw new Error("project transient is required")
  }

  return {
    ...baseRequest,
    project,
    projectMembership: undefined,
  } satisfies EndpointRequestWithProject
})

export const endpointRequestWithOrganizationAndProjectAndDocumentFactory = Factory.define<
  EndpointRequestWithDocument,
  EndpointRequestWithOrganizationAndProjectAndDocumentTransientParams
>(({ transientParams }) => {
  const organization = transientParams.organization
  const user = transientParams.user
  const project = transientParams.project
  const document = transientParams.document
  const baseRequest = endpointRequestWithOrganizationFactory
    .transient({ organization, user })
    .build()

  if (!project) {
    throw new Error("project transient is required")
  }

  if (!document) {
    throw new Error("document transient is required")
  }

  return {
    ...baseRequest,
    project,
    projectMembership: undefined,
    document,
  } satisfies EndpointRequestWithDocument
})

export const endpointRequestWithAgentFactory = Factory.define<
  EndpointRequestWithAgent,
  EndpointRequestWithAgentTransientParams
>(({ transientParams }) => {
  const organization = transientParams.organization
  const user = transientParams.user
  const project = transientParams.project
  const agent = transientParams.agent
  const baseRequest = endpointRequestWithOrganizationFactory
    .transient({ organization, user })
    .build()

  if (!project) {
    throw new Error("project transient is required")
  }

  if (!agent) {
    throw new Error("agent transient is required")
  }

  return {
    ...baseRequest,
    project,
    projectMembership: undefined,
    agent,
    agentMembership: undefined,
  } satisfies EndpointRequestWithAgent
})

export const buildEndpointRequestWithOrganizationAndProject = (
  organization: Organization,
  user: User,
  project: Project,
) => {
  return endpointRequestWithOrganizationAndProjectFactory
    .transient({ organization, user, project })
    .build()
}

export const buildEndpointRequestWithOrganizationAndProjectAndDocument = (params: {
  organization: Organization
  user: User
  project: Project
  document: Document
}) => {
  return endpointRequestWithOrganizationAndProjectAndDocumentFactory.transient(params).build()
}

export const buildEndpointRequestWithAgent = (params: {
  organization: Organization
  user: User
  project: Project
  agent: Agent
}) => {
  return endpointRequestWithAgentFactory.transient(params).build()
}
