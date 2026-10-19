import { ConversationAgentSessionsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { In } from "typeorm"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { agentMessageFeedbackFactory } from "@/domains/agents/shared/agent-session-messages/feedback/agent-message-feedback.factory"
import { conversationFormFactory } from "@/domains/agents/shared/conversation-forms/conversation-form.factory"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { conversationAgentSessionFactory } from "../conversation-agent-session.factory"
import { ConversationAgentSessionsModule } from "../conversation-agent-sessions.module"

describe("ConversationAgentSessionsRoutes.deleteOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

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
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { organization, project, user, agent, agentSettings, agentSession } =
      await createOrganizationWithAgentSession({
        repositories,
        params: { agentSession: { type: "live" } },
        agentType: "conversation",
      })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    authSubject = user.authSubject!
    return { organization, project, user, agent, agentSettings, agentSession }
  }

  const subject = async () =>
    request({
      route: ConversationAgentSessionsRoutes.live.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
      token: accessToken,
    })

  it("deletes the session with its messages, forms and sub-sessions", async () => {
    const { organization, project, user, agent, agentSettings, agentSession } =
      await createContext()
    const subAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ type: "conversation" }),
    )
    const subAgentSettings = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent: subAgent }).build(),
    )
    const subSession = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, user, agent: subAgent })
        .live()
        .build({ parentSessionId: agentSession.id }),
    )
    const otherSession = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, user, agent })
        .live()
        .build(),
    )
    const [sessionMessage, subSessionMessage, otherSessionMessage] =
      await repositories.agentMessageRepository.save([
        agentMessageFactory
          .transient({ organization, project, session: agentSession, agentSettings })
          .build(),
        agentMessageFactory
          .transient({
            organization,
            project,
            session: subSession,
            agentSettings: subAgentSettings,
          })
          .build(),
        agentMessageFactory
          .transient({ organization, project, session: otherSession, agentSettings })
          .build(),
      ])
    await repositories.agentMessageFeedbackRepository.save(
      agentMessageFeedbackFactory
        .transient({ organization, project, agentMessage: subSessionMessage!, user })
        .build(),
    )
    await repositories.conversationFormRepository.save([
      conversationFormFactory
        .transient({ organization, project, agent, agentSettings, session: agentSession })
        .build(),
      conversationFormFactory
        .transient({
          organization,
          project,
          agent: subAgent,
          agentSettings: subAgentSettings,
          session: subSession,
        })
        .build(),
    ])

    expectResponse(await subject(), 201)

    expect(
      await repositories.conversationAgentSessionRepository.findBy({
        id: In([agentSession.id, subSession.id]),
      }),
    ).toEqual([])
    expect(
      await repositories.agentMessageRepository.findBy({
        id: In([sessionMessage!.id, subSessionMessage!.id]),
      }),
    ).toEqual([])
    expect(
      await repositories.conversationFormRepository.findBy({
        sessionId: In([agentSession.id, subSession.id]),
      }),
    ).toEqual([])
    expect(
      await repositories.conversationAgentSessionRepository.findOneBy({ id: otherSession.id }),
    ).not.toBeNull()
    expect(
      await repositories.agentMessageRepository.findOneBy({ id: otherSessionMessage!.id }),
    ).not.toBeNull()
  })

  it("also deletes a sub-session left behind by a deleted sub-agent, with its form", async () => {
    const { organization, project, user, agentSession } = await createContext()
    const subAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ type: "conversation" }),
    )
    const subAgentSettings = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent: subAgent }).build(),
    )
    const subSession = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, user, agent: subAgent })
        .live()
        .build({ parentSessionId: agentSession.id }),
    )
    const subSessionForm = await repositories.conversationFormRepository.save(
      conversationFormFactory
        .transient({
          organization,
          project,
          agent: subAgent,
          agentSettings: subAgentSettings,
          session: subSession,
        })
        .build(),
    )
    // Deleting an agent soft-deletes every row it owns, its sub-sessions and their forms included.
    await repositories.conversationAgentSessionRepository.softDelete({ id: subSession.id })
    await repositories.conversationFormRepository.softDelete({ id: subSessionForm.id })

    expectResponse(await subject(), 201)

    expect(
      await repositories.conversationAgentSessionRepository.find({
        where: { id: subSession.id },
        withDeleted: true,
      }),
    ).toEqual([])
    expect(
      await repositories.conversationFormRepository.find({
        where: { id: subSessionForm.id },
        withDeleted: true,
      }),
    ).toEqual([])
  })

  it("answers 404 for a review campaign session and keeps it", async () => {
    const { organization, project, agent, agentSettings, agentSession } = await createContext()
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    await repositories.conversationAgentSessionRepository.update(
      { id: agentSession.id },
      { campaignId: campaign.id },
    )

    expectResponse(await subject(), 404)

    expect(
      await repositories.conversationAgentSessionRepository.findOneBy({ id: agentSession.id }),
    ).not.toBeNull()
  })
})
