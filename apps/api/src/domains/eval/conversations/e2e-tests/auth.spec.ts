import { randomUUID } from "node:crypto"
import { EvalConversationsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import supertest from "supertest"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { agentMessageAttachmentDocumentFactory } from "@/domains/agents/shared/agent-session-messages/agent-message-attachment-document.factory"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { RoleGrant } from "@/domains/rbac/role-grant.entity"
import {
  addUserToReviewCampaign,
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import type { ReviewCampaignRoleKey } from "@/domains/review-campaigns/memberships/review-campaign-membership.types"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { reviewCampaignStatusErrorMessage } from "@/domains/review-campaigns/review-campaign-status"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../test/schema-request"
import { EvalModule } from "../../eval.module"

/** The routes of a tester's session, checked on the session's campaign. */
type SessionRouteName =
  | "getMessages"
  | "getMcpAppsHtml"
  | "presignAttachment"
  | "getAttachmentUrl"
  | "streamReply"

const SESSION_ROUTE_NAMES: SessionRouteName[] = [
  "getMessages",
  "getMcpAppsHtml",
  "presignAttachment",
  "getAttachmentUrl",
  "streamReply",
]

describe("Evaluation conversations - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let agentId: string = randomUUID()
  let agentSessionId: string = randomUUID()
  let agentMessageId: string = randomUUID()
  let attachmentDocumentId: string = randomUUID()
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
    agentId = randomUUID()
    agentSessionId = randomUUID()
    agentMessageId = randomUUID()
    attachmentDocumentId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /**
   * Seeds an active campaign where the caller holds `roleKey` and no project role, a tester session
   * of the caller in it with one reply of the agent, and an attachment that reply carries, so every
   * route has a target.
   */
  const createContext = async (roleKey: ReviewCampaignRoleKey = "review_campaign_tester") => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { agent: { type: "conversation" } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    const { user } = await addUserToReviewCampaign({
      repositories,
      organization,
      project,
      campaign,
      roleKeys: [roleKey],
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    const agentSession = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .reviewCampaignTester()
        .build({ campaignId: campaign.id }),
    )
    const attachmentDocument = await repositories.agentMessageAttachmentDocumentRepository.save(
      agentMessageAttachmentDocumentFactory.transient({ organization, project }).build(),
    )
    const agentMessage = await repositories.agentMessageRepository.save(
      agentMessageFactory
        .assistant()
        .transient({ organization, project, session: agentSession, agentSettings })
        .build({ attachmentDocumentId: attachmentDocument.id }),
    )

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    agentMessageId = agentMessage.id
    attachmentDocumentId = attachmentDocument.id
    return { organization, project, agent, agentSettings, campaign, user }
  }

  type Context = Awaited<ReturnType<typeof createContext>>

  /** Points the path at another session of the caller, of `type`, in the campaign or in none. */
  const useOtherSessionOfCaller = async (
    { organization, project, agent, user, campaign }: Context,
    { type, inCampaign }: { type: "live" | "review_campaign_tester"; inCampaign: boolean },
  ) => {
    const agentSession = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .build({ type, campaignId: inCampaign ? campaign.id : null }),
    )
    agentSessionId = agentSession.id
  }

  /** Makes the caller a tester of a second, active campaign of the same project. */
  const joinAnotherActiveCampaign = async ({
    organization,
    project,
    agent,
    agentSettings,
    user,
  }: Context) => {
    const otherCampaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .transient({ organization, project, campaign: otherCampaign, user })
        .build({ roleKeys: ["review_campaign_tester"] }),
    })
  }

  const leaveCampaign = ({ campaign, user }: Context) =>
    setup.dataSource
      .getRepository(RoleGrant)
      .softDelete({ userId: user.id, resourceType: "review_campaign", resourceId: campaign.id })

  const closeCampaign = ({ campaign }: Context) =>
    repositories.reviewCampaignRepository.update(
      { id: campaign.id },
      { status: "closed", closedAt: new Date() },
    )

  const conversationParams = () => ({ organizationId, projectId, agentId, agentSessionId })

  /** The stream is not a schema route: its URL comes from the route, the request from supertest. */
  const streamReply = () => {
    const pending = supertest(app.getHttpServer())
      .post(EvalConversationsRoutes.streamReply.getPath(conversationParams()))
      .send({ payload: { content: "Hello" } })
      .set("Connection", "close")
    if (accessToken) pending.set("Authorization", `Bearer ${accessToken}`)
    return pending
  }

  const subjects: Record<SessionRouteName, () => Promise<supertest.Response>> = {
    getMessages: () =>
      request({
        route: EvalConversationsRoutes.getMessages,
        pathParams: conversationParams(),
        token: accessToken,
      }),
    getMcpAppsHtml: () =>
      request({
        route: EvalConversationsRoutes.getMcpAppsHtml,
        pathParams: conversationParams(),
        token: accessToken,
      }),
    presignAttachment: () =>
      request({
        route: EvalConversationsRoutes.presignAttachment,
        pathParams: conversationParams(),
        token: accessToken,
        body: { payload: { fileName: "notes.pdf", mimeType: "application/pdf", size: 1234 } },
      }),
    getAttachmentUrl: () =>
      request({
        route: EvalConversationsRoutes.getAttachmentUrl,
        pathParams: { ...conversationParams(), attachmentDocumentId },
        token: accessToken,
      }),
    streamReply,
  }

  const countSessionMessages = () =>
    repositories.agentMessageRepository.count({ where: { sessionId: agentSessionId } })

  /** Every route answers 201 (a POST), the stream 200 with no error frame. */
  const expectAllowed = async (routeName: SessionRouteName) => {
    const messageCountBefore = await countSessionMessages()
    const response = await subjects[routeName]()
    if (routeName !== "streamReply") {
      expectResponse(response, 201)
      return
    }
    expect(response.status).toBe(200)
    expect(response.text).not.toContain("event: error")
    expect(await countSessionMessages()).toBeGreaterThan(messageCountBefore)
  }

  /**
   * The handler refuses a closed campaign. The stream's handler answers it with an SSE error frame,
   * as the route it copies does (`stream-reply.spec.ts` compares the two).
   */
  const expectClosedCampaignRefused = async (routeName: SessionRouteName) => {
    const messageCountBefore = await countSessionMessages()
    const response = await subjects[routeName]()
    if (routeName === "streamReply") {
      expect(response.text).toContain("event: error")
      expect(response.text).toContain(reviewCampaignStatusErrorMessage("closed"))
    } else {
      expectResponse(response, 403, reviewCampaignStatusErrorMessage("closed"))
    }
    expect(await countSessionMessages()).toBe(messageCountBefore)
  }

  describe.each(SESSION_ROUTE_NAMES)("%s", (routeName) => {
    const subject = () => subjects[routeName]()

    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("answers 400 for an agent id that is not a UUID", async () => {
      await createContext()
      agentId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 400 for a session id that is not a UUID", async () => {
      await createContext()
      agentSessionId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown agent", async () => {
      await createContext()
      agentId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContext()
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("answers 404, never 500, for an unknown session", async () => {
      await createContext()
      agentSessionId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("answers 404, never 500, for a tester session that belongs to no campaign", async () => {
      const context = await createContext()
      await useOtherSessionOfCaller(context, { type: "review_campaign_tester", inCampaign: false })
      expectResponse(await subject(), 404)
    })

    it("answers 404 for a live session", async () => {
      const context = await createContext()
      await useOtherSessionOfCaller(context, { type: "live", inCampaign: false })
      expectResponse(await subject(), 404)
    })

    it("answers 404 for another tester's session of the campaign", async () => {
      const { organization, project, campaign } = await createContext()
      const otherTesterAuthSubject = `oidc|${randomUUID()}`
      await addUserToReviewCampaign({
        repositories,
        organization,
        project,
        campaign,
        user: {
          authSubject: otherTesterAuthSubject,
          email: mockOidcEmailForSub(otherTesterAuthSubject),
        },
      })
      authSubject = otherTesterAuthSubject
      const messageCountBefore = await countSessionMessages()

      expectResponse(await subject(), 404)
      expect(await countSessionMessages()).toBe(messageCountBefore)
    })

    it("allows the tester of an active campaign in their own session", async () => {
      await createContext()
      await expectAllowed(routeName)
    })

    it("forbids a reviewer-only participant (403)", async () => {
      await createContext("review_campaign_reviewer")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("refuses the tester once the campaign is closed", async () => {
      const context = await createContext()
      await closeCampaign(context)
      await expectClosedCampaignRefused(routeName)
    })

    it("keeps the session of a closed campaign shut for a tester of another active campaign of the project", async () => {
      const context = await createContext()
      await joinAnotherActiveCampaign(context)
      await closeCampaign(context)
      await expectClosedCampaignRefused(routeName)
    })

    it("forbids someone removed from the session's campaign, even as a tester of another active campaign of the project", async () => {
      const context = await createContext()
      await joinAnotherActiveCampaign(context)
      await leaveCampaign(context)
      const messageCountBefore = await countSessionMessages()

      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      expect(await countSessionMessages()).toBe(messageCountBefore)
    })
  })

  // The handlers serve tester sessions only: a live session of the caller in the same campaign
  // answers 404, as on the routes they copy.
  describe.each<SessionRouteName>([
    "getMessages",
    "getMcpAppsHtml",
    "presignAttachment",
    "getAttachmentUrl",
  ])("%s, on a live session of the campaign", (routeName) => {
    it("answers 404", async () => {
      const context = await createContext()
      await useOtherSessionOfCaller(context, { type: "live", inCampaign: true })
      expectResponse(await subjects[routeName](), 404)
    })
  })

  it("answers 400 for an attachment id that is not a UUID", async () => {
    await createContext()
    attachmentDocumentId = "not-a-uuid"
    expectResponse(await subjects.getAttachmentUrl(), 400)
  })

  // Feedback is checked on the project, where a tester's campaign gives the key while it is active.
  describe("createMessageFeedback", () => {
    const subject = () =>
      request({
        route: EvalConversationsRoutes.createMessageFeedback,
        pathParams: { organizationId, projectId, agentMessageId },
        token: accessToken,
        body: { payload: { rating: "negative", content: "Out of date prices" } },
      })

    const countFeedbacks = () =>
      repositories.agentMessageFeedbackRepository.count({ where: { agentMessageId } })

    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("answers 400 for a message id that is not a UUID", async () => {
      await createContext()
      agentMessageId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown project", async () => {
      await createContext()
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContext()
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("lets a tester of an active campaign give feedback on a reply of their session", async () => {
      await createContext()
      expectResponse(await subject(), 201)
      expect(await countFeedbacks()).toBe(1)
    })

    it("forbids the tester once the campaign is closed", async () => {
      const context = await createContext()
      await closeCampaign(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      expect(await countFeedbacks()).toBe(0)
    })

    it("forbids a reviewer-only participant", async () => {
      await createContext("review_campaign_reviewer")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      expect(await countFeedbacks()).toBe(0)
    })

    it("answers 404 for a message that does not exist", async () => {
      await createContext()
      agentMessageId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("answers 404 for a reply of another tester's session", async () => {
      const { organization, project, campaign } = await createContext()
      const otherTesterAuthSubject = `oidc|${randomUUID()}`
      await addUserToReviewCampaign({
        repositories,
        organization,
        project,
        campaign,
        user: {
          authSubject: otherTesterAuthSubject,
          email: mockOidcEmailForSub(otherTesterAuthSubject),
        },
      })
      authSubject = otherTesterAuthSubject

      expectResponse(await subject(), 404)
      expect(await countFeedbacks()).toBe(0)
    })
  })
})
