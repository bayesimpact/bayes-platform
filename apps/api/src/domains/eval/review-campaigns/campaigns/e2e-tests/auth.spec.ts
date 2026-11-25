import { randomUUID } from "node:crypto"
import {
  EvalCampaignInvitationsRoutes,
  EvalReviewCampaignsRoutes,
} from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { invitationFactory } from "@/domains/invitations/invitation.factory"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { projectFactory } from "@/domains/projects/project.factory"
import {
  addUserToReviewCampaign,
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import type { ReviewCampaignRoleKey } from "@/domains/review-campaigns/memberships/review-campaign-membership.types"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { userFactory } from "@/domains/users/user.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

/** The routes of a project's campaigns that the people who manage them call. */
type ManagerRouteName =
  | "getAllOfProject"
  | "getOne"
  | "createOne"
  | "updateOne"
  | "deleteOne"
  | "revokeMembership"
  | "getAllInvitations"
  | "createInvitations"
  | "deleteInvitation"

/** The routes of a campaign that its testers or reviewers call. */
type ParticipantRouteName = "getReport" | "getContext"

type RouteName = ManagerRouteName | ParticipantRouteName

/** The status of an allowed call. */
const MANAGER_ROUTE_STATUSES: Record<ManagerRouteName, number> = {
  getAllOfProject: 200,
  getOne: 200,
  createOne: 201,
  updateOne: 200,
  deleteOne: 200,
  revokeMembership: 200,
  getAllInvitations: 200,
  createInvitations: 201,
  deleteInvitation: 200,
}

const MANAGER_ROUTE_NAMES = Object.keys(MANAGER_ROUTE_STATUSES) as ManagerRouteName[]

const ROUTE_NAMES: RouteName[] = [...MANAGER_ROUTE_NAMES, "getReport", "getContext"]

/** The routes that load the campaign of their path (`reviewCampaign` context today). */
const CAMPAIGN_ROUTE_NAMES: RouteName[] = ROUTE_NAMES.filter(
  (routeName) => routeName !== "getAllOfProject" && routeName !== "createOne",
)

/**
 * The status of the campaign each route needs to answer its allowed status: deleting or editing a
 * campaign needs a draft, inviting people and reading it as a participant need an active one.
 */
const CAMPAIGN_STATUS_BY_ROUTE: Record<RouteName, "draft" | "active"> = {
  getAllOfProject: "draft",
  getOne: "draft",
  createOne: "draft",
  updateOne: "draft",
  deleteOne: "draft",
  revokeMembership: "draft",
  getAllInvitations: "active",
  createInvitations: "active",
  deleteInvitation: "active",
  getReport: "active",
  getContext: "active",
}

describe("Evaluation review campaigns - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
  let membershipId: string = randomUUID()
  let invitationId: string = randomUUID()
  let agentId: string = randomUUID()
  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = randomUUID()
    projectId = randomUUID()
    reviewCampaignId = randomUUID()
    membershipId = randomUUID()
    invitationId = randomUUID()
    agentId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /**
   * A project with an agent and a campaign of the given status, with a tester's membership and a
   * pending invitation, and a caller who holds the given project roles.
   */
  const createContextForRoles = async (
    campaignStatus: "draft" | "active",
    ...roleKeys: ProjectRoleKey[]
  ) => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
        projectMembership: { roleKeys },
      },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      (campaignStatus === "active" ? reviewCampaignFactory.active() : reviewCampaignFactory)
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    const tester = await repositories.userRepository.save(userFactory.build())
    const membership = await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .withRoles("review_campaign_tester")
        .transient({ organization, project, campaign, user: tester })
        .build(),
    })
    const invitedUser = await repositories.userRepository.save(
      userFactory.build({ authSubject: null }),
    )
    const invitation = await repositories.invitationRepository.save(
      invitationFactory.transient({ user: invitedUser, reviewCampaign: campaign }).build(),
    )
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    membershipId = membership.id
    invitationId = invitation.id
    agentId = agent.id
    return { organization, project, agent, agentSettings, campaign }
  }

  /** Switches the caller to an organization admin who holds no role on the project. */
  const switchToOrganizationAdminWithoutProjectRole = async ({
    organization,
  }: Awaited<ReturnType<typeof createContextForRoles>>) => {
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    await addUserToOrganization({
      repositories,
      organization,
      user: {
        authSubject: organizationAdminAuthSubject,
        email: mockOidcEmailForSub(organizationAdminAuthSubject),
      },
      membership: { roleKeys: ["org_admin"] },
    })
    authSubject = organizationAdminAuthSubject
  }

  /** Switches the caller to a member of the organization who holds these campaign roles only. */
  const switchToCampaignParticipant = async (
    { organization, project, campaign }: Awaited<ReturnType<typeof createContextForRoles>>,
    roleKey: ReviewCampaignRoleKey,
  ) => {
    const participantAuthSubject = `oidc|${randomUUID()}`
    const { user } = await addUserToReviewCampaign({
      repositories,
      organization,
      project,
      campaign,
      roleKeys: [roleKey],
      user: {
        authSubject: participantAuthSubject,
        email: mockOidcEmailForSub(participantAuthSubject),
      },
    })
    authSubject = participantAuthSubject
    return user
  }

  /** Switches the caller to a member of the organization who holds this project role only. */
  const switchToProjectMember = async (
    context: Awaited<ReturnType<typeof createContextForRoles>>,
    roleKey: ProjectRoleKey,
  ) => {
    const memberAuthSubject = `oidc|${randomUUID()}`
    const { user } = await addUserToOrganization({
      repositories,
      organization: context.organization,
      user: { authSubject: memberAuthSubject, email: mockOidcEmailForSub(memberAuthSubject) },
      membership: { roleKeys: ["org_member"] },
    })
    await addUserToProject({
      repositories,
      project: context.project,
      user,
      membership: { roleKeys: [roleKey] },
    })
    authSubject = memberAuthSubject
    return user
  }

  const campaignParams = () => ({ organizationId, projectId, reviewCampaignId })

  const subjects: Record<RouteName, () => ReturnType<SchemaRequester>> = {
    getAllOfProject: () =>
      request({
        route: EvalReviewCampaignsRoutes.getAllOfProject,
        pathParams: { organizationId, projectId },
        token: accessToken,
      }),
    getOne: () =>
      request({
        route: EvalReviewCampaignsRoutes.getOne,
        pathParams: campaignParams(),
        token: accessToken,
      }),
    createOne: () =>
      request({
        route: EvalReviewCampaignsRoutes.createOne,
        pathParams: { organizationId, projectId },
        body: {
          payload: {
            agentId,
            name: "Helpful Assistant review",
            description: null,
            testerPerSessionQuestions: [],
            testerEndOfPhaseQuestions: [],
            reviewerQuestions: [],
          },
        },
        token: accessToken,
      }),
    updateOne: () =>
      request({
        route: EvalReviewCampaignsRoutes.updateOne,
        pathParams: campaignParams(),
        body: { payload: { name: "Renamed" } },
        token: accessToken,
      }),
    deleteOne: () =>
      request({
        route: EvalReviewCampaignsRoutes.deleteOne,
        pathParams: campaignParams(),
        token: accessToken,
      }),
    revokeMembership: () =>
      request({
        route: EvalReviewCampaignsRoutes.revokeMembership,
        pathParams: { ...campaignParams(), membershipId },
        token: accessToken,
      }),
    getReport: () =>
      request({
        route: EvalReviewCampaignsRoutes.getReport,
        pathParams: campaignParams(),
        token: accessToken,
      }),
    getContext: () =>
      request({
        route: EvalReviewCampaignsRoutes.getContext,
        pathParams: campaignParams(),
        token: accessToken,
      }),
    getAllInvitations: () =>
      request({
        route: EvalCampaignInvitationsRoutes.getAll,
        pathParams: campaignParams(),
        token: accessToken,
      }),
    createInvitations: () =>
      request({
        route: EvalCampaignInvitationsRoutes.createMany,
        pathParams: campaignParams(),
        body: { payload: { emails: ["invited@example.com"], role: "tester", language: "en" } },
        token: accessToken,
      }),
    deleteInvitation: () =>
      request({
        route: EvalCampaignInvitationsRoutes.deleteOne,
        pathParams: { ...campaignParams(), invitationId },
        token: accessToken,
      }),
  }

  describe.each(ROUTE_NAMES)("%s, under a project", (routeName) => {
    const subject = () => subjects[routeName]()
    const campaignStatus = CAMPAIGN_STATUS_BY_ROUTE[routeName]

    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("answers 400 for an organization id that is not a UUID", async () => {
      await createContextForRoles(campaignStatus, "project_owner")
      organizationId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 400 for a project id that is not a UUID", async () => {
      await createContextForRoles(campaignStatus, "project_owner")
      projectId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("requires an existing project of the organization", async () => {
      await createContextForRoles(campaignStatus, "project_owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRoles(campaignStatus, "project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("doesn't let a project member in", async () => {
      await createContextForRoles(campaignStatus, "project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("doesn't let an organization admin outside the project in", async () => {
      const context = await createContextForRoles(campaignStatus, "project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe.each(CAMPAIGN_ROUTE_NAMES)("%s, its campaign", (routeName) => {
    const subject = () => subjects[routeName]()
    const campaignStatus = CAMPAIGN_STATUS_BY_ROUTE[routeName]

    it("answers 400 for a campaign id that is not a UUID", async () => {
      await createContextForRoles(campaignStatus, "project_owner")
      reviewCampaignId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown campaign", async () => {
      await createContextForRoles(campaignStatus, "project_owner")
      reviewCampaignId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("answers 404 for a campaign of another project", async () => {
      const { organization, agent, agentSettings } = await createContextForRoles(
        campaignStatus,
        "project_owner",
      )
      const otherProject = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      const otherCampaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory
          .active()
          .transient({ organization, project: otherProject, agent, agentSettings })
          .build(),
      )
      reviewCampaignId = otherCampaign.id
      expectResponse(await subject(), 404)
    })
  })

  // `project.review_campaign.*` on the project: the project's owners and admins hold them.
  describe.each(MANAGER_ROUTE_NAMES)("%s, for the people who manage campaigns", (routeName) => {
    const subject = () => subjects[routeName]()
    const campaignStatus = CAMPAIGN_STATUS_BY_ROUTE[routeName]

    it("doesn't let a tester of the campaign in", async () => {
      const context = await createContextForRoles(campaignStatus, "project_owner")
      await switchToCampaignParticipant(context, "review_campaign_tester")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("doesn't let a reviewer of the campaign in", async () => {
      const context = await createContextForRoles(campaignStatus, "project_owner")
      await switchToCampaignParticipant(context, "review_campaign_reviewer")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it.each(["project_owner", "project_admin"] as const)("lets a %s in", async (roleKey) => {
      await createContextForRoles(campaignStatus, roleKey)
      expectResponse(await subject(), MANAGER_ROUTE_STATUSES[routeName])
    })
  })

  // `review_campaign.report.read` on the campaign: its reviewers hold it, and the project's owners
  // and admins get it from the project.
  describe("getReport, for the readers of the report", () => {
    const subject = () => subjects.getReport()

    it("lets a reviewer of the campaign in", async () => {
      const context = await createContextForRoles("active", "project_owner")
      await switchToCampaignParticipant(context, "review_campaign_reviewer")
      expectResponse(await subject(), 200)
    })

    it("doesn't let a tester of the campaign in", async () => {
      const context = await createContextForRoles("active", "project_owner")
      await switchToCampaignParticipant(context, "review_campaign_tester")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("doesn't let a project member who takes no part in the campaign in", async () => {
      const context = await createContextForRoles("active", "project_owner")
      await switchToProjectMember(context, "project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it.each(["project_owner", "project_admin"] as const)("lets a %s in", async (roleKey) => {
      await createContextForRoles("active", roleKey)
      expectResponse(await subject(), 200)
    })
  })

  // `review_campaign.read` on the campaign: its testers and reviewers hold it, and the project's
  // owners do not.
  describe("getContext, for the participants", () => {
    const subject = () => subjects.getContext()

    it.each([
      "review_campaign_tester",
      "review_campaign_reviewer",
    ] as const)("lets a participant with %s in", async (roleKey) => {
      const context = await createContextForRoles("active", "project_owner")
      await switchToCampaignParticipant(context, roleKey)
      expectResponse(await subject(), 200)
    })

    it("doesn't let a project owner who takes no part in the campaign in", async () => {
      await createContextForRoles("active", "project_owner")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("getAllMine", () => {
    const subject = () =>
      request({
        route: EvalReviewCampaignsRoutes.getAllMine,
        query: { role: "tester" },
        token: accessToken,
      })

    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("answers to any signed-in person", async () => {
      await createContextForRoles("active", "project_member")
      expectResponse(await subject(), 200)
    })
  })
})
