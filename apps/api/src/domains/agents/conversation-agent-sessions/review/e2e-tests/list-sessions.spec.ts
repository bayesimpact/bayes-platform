import { randomUUID } from "node:crypto"
import { ConversationReviewRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { ConversationAgentSessionCategory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session-category.entity"
import { AgentSessionCategory } from "@/domains/agents/session-categories/agent-session-category.entity"
import { ProjectAgentSessionCategory } from "@/domains/agents/session-categories/project-agent-session-category.entity"
import { appInstallationFactory } from "@/domains/apps/app-installation.factory"
import { appManifestFactory } from "@/domains/apps/app-manifest.factory"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { agentEmbedConfigFactory } from "@/domains/public-chat/agent-embed-configs/agent-embed-config.factory"
import { publicAgentSessionFactory } from "@/domains/public-chat/public-agent-sessions/public-agent-session.factory"
import { PublicAgentSessionCategory } from "@/domains/public-chat/public-agent-sessions/public-agent-session-category.entity"
import { userFactory } from "@/domains/users/user.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import {
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { grantConversationReview } from "../../../conversation-reviewers/agent-conversation-reviewer.factory"
import { ConversationAgentSessionsModule } from "../../conversation-agent-sessions.module"

describe("ConversationReviewRoutes.listSessions", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organization: Organization
  let organizationId: string
  let projectId: string
  let agentId: string
  let productCategoryId: string
  let pricingCategoryId: string
  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ConversationAgentSessionsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /**
   * The owner's agent, two categories of the project (each materialized on the agent) and the
   * sessions they tagged: conversation sessions (live, playground, one untagged, one tagged
   * with both categories) and public sessions (one embed tagged, one app untagged).
   */
  const createContext = async () => {
    const context = await createOrganizationWithAgent(repositories)
    organization = context.organization
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id

    const productProjectCategory = await setup.getRepository(ProjectAgentSessionCategory).save({
      projectId,
      name: "Product",
    })
    const pricingProjectCategory = await setup.getRepository(ProjectAgentSessionCategory).save({
      projectId,
      name: "Pricing",
    })
    productCategoryId = productProjectCategory.id
    pricingCategoryId = pricingProjectCategory.id

    const productAgentCategory = await setup.getRepository(AgentSessionCategory).save({
      agentId,
      name: "Product",
      projectAgentSessionCategoryId: productProjectCategory.id,
    })
    const pricingAgentCategory = await setup.getRepository(AgentSessionCategory).save({
      agentId,
      name: "Pricing",
      projectAgentSessionCategoryId: pricingProjectCategory.id,
    })

    const conversationSessionParams = {
      organization: context.organization,
      project: context.project,
      user: context.user,
      agent: context.agent,
    }
    const productSession = conversationAgentSessionFactory
      .transient(conversationSessionParams)
      .live()
      .build({ createdAt: new Date("2026-01-01T10:00:00.000Z") })
    const pricingSession = conversationAgentSessionFactory
      .transient(conversationSessionParams)
      .playground()
      .build({ createdAt: new Date("2026-01-02T10:00:00.000Z") })
    const untaggedSession = conversationAgentSessionFactory
      .transient(conversationSessionParams)
      .live()
      .build({ createdAt: new Date("2026-01-03T10:00:00.000Z") })
    const bothCategoriesSession = conversationAgentSessionFactory
      .transient(conversationSessionParams)
      .live()
      .build({ createdAt: new Date("2026-01-04T10:00:00.000Z") })
    const subSession = conversationAgentSessionFactory
      .transient(conversationSessionParams)
      .live()
      .build({
        parentSessionId: productSession.id,
        createdAt: new Date("2026-01-07T10:00:00.000Z"),
      })
    await repositories.conversationAgentSessionRepository.save([
      productSession,
      pricingSession,
      untaggedSession,
      bothCategoriesSession,
      subSession,
    ])

    const embedConfig = agentEmbedConfigFactory
      .transient({
        organization: context.organization,
        project: context.project,
        agent: context.agent,
      })
      .build()
    await repositories.agentEmbedConfigRepository.save(embedConfig)
    const appManifest = appManifestFactory.build()
    await repositories.appManifestRepository.save(appManifest)
    const appInstallation = appInstallationFactory.build({
      appManifestId: appManifest.id,
      projectId,
    })
    await repositories.appInstallationRepository.save(appInstallation)

    const embedSession = publicAgentSessionFactory
      .transient({ embedConfig })
      .build({ createdAt: new Date("2026-01-05T10:00:00.000Z") })
    // The App channel: no embed config, explicit scope and installation.
    const appSession = publicAgentSessionFactory.build({
      organizationId: context.organization.id,
      projectId: context.project.id,
      agentId: context.agent.id,
      appInstallationId: appInstallation.id,
      createdAt: new Date("2026-01-06T10:00:00.000Z"),
    })
    await repositories.publicAgentSessionRepository.save([embedSession, appSession])

    await setup.getRepository(ConversationAgentSessionCategory).save([
      {
        conversationAgentSessionId: productSession.id,
        agentSessionCategoryId: productAgentCategory.id,
      },
      {
        conversationAgentSessionId: pricingSession.id,
        agentSessionCategoryId: pricingAgentCategory.id,
      },
      {
        conversationAgentSessionId: bothCategoriesSession.id,
        agentSessionCategoryId: productAgentCategory.id,
      },
      {
        conversationAgentSessionId: bothCategoriesSession.id,
        agentSessionCategoryId: pricingAgentCategory.id,
      },
      {
        conversationAgentSessionId: subSession.id,
        agentSessionCategoryId: productAgentCategory.id,
      },
    ])
    await setup
      .getRepository(PublicAgentSessionCategory)
      .save([
        { publicAgentSessionId: embedSession.id, agentSessionCategoryId: productAgentCategory.id },
      ])

    return {
      ...context,
      productSessionId: productSession.id,
      pricingSessionId: pricingSession.id,
      untaggedSessionId: untaggedSession.id,
      bothCategoriesSessionId: bothCategoriesSession.id,
      subSessionId: subSession.id,
      embedSessionId: embedSession.id,
      appSessionId: appSession.id,
    }
  }

  /** The caller: a plain member of the organization, with no project or agent membership. */
  const createCaller = async () => {
    const { user } = await addUserToOrganization({
      repositories,
      organization,
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    return user
  }

  const subject = async (query: Record<string, string> = {}) =>
    request({
      route: ConversationReviewRoutes.listSessions,
      pathParams: { organizationId, projectId, agentId },
      token: accessToken,
      query,
    })

  it("requires an authentication token", async () => {
    await createContext()
    accessToken = undefined
    expectResponse(await subject({ categoryId: "uncategorized" }), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("rejects the owner of the project and agent, who was not granted the review", async () => {
    const { user } = await createContext()
    authSubject = user.authSubject as string
    expectResponse(
      await subject({ categoryId: "uncategorized" }),
      403,
      AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
    )
  })

  it("rejects a platform superadmin who was not granted the review", async () => {
    await createContext()
    const caller = await createCaller()
    await assignPlatformSuperadminToUser({ repositories, user: caller })
    expectResponse(
      await subject({ categoryId: "uncategorized" }),
      403,
      AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
    )
  })

  it("rejects a reviewer of another agent of the same project", async () => {
    const { project } = await createContext()
    const caller = await createCaller()
    const otherAgent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(otherAgent)
    await grantConversationReview({ repositories, user: caller, agent: otherAgent })
    expectResponse(
      await subject({ categoryId: "uncategorized" }),
      403,
      AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
    )
  })

  it("rejects a reviewer of the agent who is outside the organization", async () => {
    const { agent } = await createContext()
    const outsider = userFactory.build({ authSubject, email: mockOidcEmailForSub(authSubject) })
    await repositories.userRepository.save(outsider)
    await grantConversationReview({ repositories, user: outsider, agent })
    expectResponse(
      await subject({ categoryId: "uncategorized" }),
      401,
      AUTH_ERRORS.NOT_MEMBER_OF_ORG,
    )
  })

  it("lists the sessions a category tagged, conversation and public, newest first", async () => {
    const created = await createContext()
    const caller = await createCaller()
    await grantConversationReview({ repositories, user: caller, agent: created.agent })

    const response = await subject({ categoryId: productCategoryId })

    expectResponse(response, 200)
    expect(response.body.data).toEqual({
      // The sub-session (01-07), the embed session (01-05), the both-categories conversation
      // (01-04) and the product conversation (01-01) — newest first, across the two kinds.
      sessions: [
        {
          sessionId: created.subSessionId,
          kind: "conversation",
          conversationType: "live",
          isSubSession: true,
          categoryId: productCategoryId,
          categoryName: "Product",
          createdAt: new Date("2026-01-07T10:00:00.000Z").getTime(),
        },
        {
          sessionId: created.embedSessionId,
          kind: "public",
          isSubSession: false,
          channel: "embed",
          categoryId: productCategoryId,
          categoryName: "Product",
          createdAt: new Date("2026-01-05T10:00:00.000Z").getTime(),
        },
        {
          sessionId: created.bothCategoriesSessionId,
          kind: "conversation",
          conversationType: "live",
          isSubSession: false,
          categoryId: productCategoryId,
          categoryName: "Product",
          createdAt: new Date("2026-01-04T10:00:00.000Z").getTime(),
        },
        {
          sessionId: created.productSessionId,
          kind: "conversation",
          conversationType: "live",
          isSubSession: false,
          categoryId: productCategoryId,
          categoryName: "Product",
          createdAt: new Date("2026-01-01T10:00:00.000Z").getTime(),
        },
      ],
      total: 4,
      page: 1,
      limit: 20,
    })
  })

  it("lists a session tagged with two categories once per category", async () => {
    const created = await createContext()
    const caller = await createCaller()
    await grantConversationReview({ repositories, user: caller, agent: created.agent })

    const productList = await subject({ categoryId: productCategoryId })
    const pricingList = await subject({ categoryId: pricingCategoryId })

    expectResponse(productList, 200)
    expectResponse(pricingList, 200)
    expect(productList.body.data.sessions.map((row) => row.sessionId)).toEqual(
      expect.arrayContaining([created.bothCategoriesSessionId]),
    )
    expect(pricingList.body.data.sessions.map((row) => row.sessionId)).toEqual(
      expect.arrayContaining([created.bothCategoriesSessionId, created.pricingSessionId]),
    )
    expect(pricingList.body.data.total).toBe(2)
    expect(pricingList.body.data.sessions[0]).toMatchObject({
      sessionId: created.bothCategoriesSessionId,
      kind: "conversation",
      conversationType: "live",
      categoryName: "Pricing",
    })
  })

  it("lists the sessions no category tagged under uncategorized", async () => {
    const created = await createContext()
    const caller = await createCaller()
    await grantConversationReview({ repositories, user: caller, agent: created.agent })

    const response = await subject({ categoryId: "uncategorized" })

    expectResponse(response, 200)
    // The app session (01-06) and the untagged conversation (01-03): the tagged ones
    // stay in their categories.
    expect(response.body.data.sessions).toEqual([
      {
        sessionId: created.appSessionId,
        kind: "public",
        isSubSession: false,
        channel: "app",
        categoryId: null,
        categoryName: "uncategorized",
        createdAt: new Date("2026-01-06T10:00:00.000Z").getTime(),
      },
      {
        sessionId: created.untaggedSessionId,
        kind: "conversation",
        conversationType: "live",
        isSubSession: false,
        categoryId: null,
        categoryName: "uncategorized",
        createdAt: new Date("2026-01-03T10:00:00.000Z").getTime(),
      },
    ])
    expect(response.body.data.total).toBe(2)
  })

  it("paginates the list newest first, with a stable total", async () => {
    const created = await createContext()
    const caller = await createCaller()
    await grantConversationReview({ repositories, user: caller, agent: created.agent })

    const firstPage = await subject({ categoryId: "uncategorized", limit: "1" })
    const secondPage = await subject({ categoryId: "uncategorized", limit: "1", page: "2" })

    expectResponse(firstPage, 200)
    expectResponse(secondPage, 200)
    expect(firstPage.body.data.sessions.map((row) => row.sessionId)).toEqual([created.appSessionId])
    expect(firstPage.body.data).toMatchObject({ total: 2, page: 1, limit: 1 })
    expect(secondPage.body.data.sessions.map((row) => row.sessionId)).toEqual([
      created.untaggedSessionId,
    ])
    expect(secondPage.body.data).toMatchObject({ total: 2, page: 2, limit: 1 })
  })

  it("returns an empty list for a category the agent has no sessions of", async () => {
    const { agent } = await createContext()
    const caller = await createCaller()
    await grantConversationReview({ repositories, user: caller, agent })
    // A category of the same project the agent never tagged a session with.
    const supportCategory = await setup.getRepository(ProjectAgentSessionCategory).save({
      projectId,
      name: "Support",
    })

    const response = await subject({ categoryId: supportCategory.id })

    expectResponse(response, 200)
    expect(response.body.data).toEqual({ sessions: [], total: 0, page: 1, limit: 20 })
  })

  it("rejects a categoryId that is neither a category id nor uncategorized", async () => {
    const { agent } = await createContext()
    const caller = await createCaller()
    await grantConversationReview({ repositories, user: caller, agent })

    expectResponse(await subject({ categoryId: "not-a-uuid" }), 400)
    expectResponse(await subject({ categoryId: "" }), 400)
    expectResponse(await subject({}), 400)
  })
})
