import type {
  AgentMembershipDto,
  OrganizationMembershipDto,
  ProjectMembershipDto,
  ReviewCampaignMembershipForMeDto,
  ReviewCampaignPermission,
} from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import { buildMembershipRoleDto } from "@/common/features/memberships/membership-roles.factory"
import type { Organization } from "@/common/features/organizations/organizations.models"
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
    conversationReviewAgentIds: params.conversationReviewAgentIds ?? [],
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
  organization: Organization
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
      organizationId: organization.id,
      userId: params.userId ?? user?.id ?? faker.string.uuid(),
      roles: [buildMembershipRoleDto({ scopeType: "organization", role: "member" })],
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
      projectId: project.id,
      userId: params.userId ?? user?.id ?? faker.string.uuid(),
      userName: params.userName ?? user?.name ?? `${firstName} ${lastName}`,
      userEmail:
        params.userEmail ??
        user?.email ??
        faker.internet.email({ firstName, lastName }).toLowerCase(),
      userHasSignedIn: params.userHasSignedIn ?? true,
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      roles: [buildMembershipRoleDto({ scopeType: "project", role: "member" })],
      permissions: params.permissions ?? [],
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
      agentId: agent.id,
      userId: params.userId ?? user?.id ?? faker.string.uuid(),
      userName: params.userName ?? user?.name ?? `${firstName} ${lastName}`,
      userEmail:
        params.userEmail ??
        user?.email ??
        faker.internet.email({ firstName, lastName }).toLowerCase(),
      userHasSignedIn: params.userHasSignedIn ?? true,
      roles: [buildMembershipRoleDto({ scopeType: "agent", role: "member" })],
      createdAt: params.createdAt ?? faker.date.past().getTime(),
    } satisfies AgentMembershipDto
  },
)

type ReviewCampaignMembershipTransientParams = {
  project: Project
}

/** What the API gives a tester on an active campaign. */
const TESTER_PERMISSIONS: ReviewCampaignPermission[] = [
  "review_campaign.read",
  "review_campaign.tester_session.read",
  "review_campaign.tester_session.create",
  "review_campaign.tester_session.delete",
  "review_campaign.tester_feedback.create",
  "review_campaign.tester_feedback.update",
  "review_campaign.tester_survey.read",
  "review_campaign.tester_survey.create",
  "review_campaign.tester_survey.update",
]

/** What the API gives a reviewer on an active or closed campaign. */
const REVIEWER_PERMISSIONS: ReviewCampaignPermission[] = [
  "review_campaign.read",
  "review_campaign.reviewer_session.read",
  "review_campaign.reviewer_review.create",
  "review_campaign.reviewer_review.update",
  "review_campaign.report.read",
]

class ReviewCampaignMembershipFactory extends Factory<
  ReviewCampaignMembershipForMeDto,
  ReviewCampaignMembershipTransientParams
> {
  asTester() {
    return this.params({ permissions: TESTER_PERMISSIONS })
  }

  asReviewer() {
    return this.params({ permissions: REVIEWER_PERMISSIONS })
  }

  /** A membership whose campaign gives nothing now, such as a draft. */
  withoutAccess() {
    return this.params({ permissions: [] })
  }
}

export const reviewCampaignMembershipFactory = ReviewCampaignMembershipFactory.define(
  ({ params, transientParams }) => {
    const { project } = transientParams
    if (!project) {
      throw new Error(
        "Project must be provided in transient params to build a ReviewCampaignMembership",
      )
    }
    return {
      campaignId: params.campaignId ?? faker.string.uuid(),
      organizationId: project.organizationId,
      projectId: project.id,
      permissions: params.permissions ?? REVIEWER_PERMISSIONS,
    } satisfies ReviewCampaignMembershipForMeDto
  },
)
