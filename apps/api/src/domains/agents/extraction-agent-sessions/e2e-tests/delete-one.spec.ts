import { ExtractionAgentSessionsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { extractionAgentSessionFactory } from "../extraction-agent-session.factory"
import { ExtractionAgentSessionsModule } from "../extraction-agent-sessions.module"

describe("ExtractionAgentSessionsRoutes.deleteOne", () => {
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
      additionalImports: [ExtractionAgentSessionsModule],
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

  it("deletes the run and keeps the caller's other runs", async () => {
    const { organization, project, user, agent, agentSettings, agentSession, document } =
      await createOrganizationWithAgentSession({ repositories, agentType: "extraction" })
    const otherRun = await repositories.extractionAgentSessionRepository.save(
      extractionAgentSessionFactory
        .transient({ organization, project, user, agent, agentSettings, document })
        .build(),
    )
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    authSubject = user.authSubject!

    const response = await request({
      route: ExtractionAgentSessionsRoutes.playground.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
      token: accessToken,
    })

    expectResponse(response, 201)
    expect(
      await repositories.extractionAgentSessionRepository.findOneBy({ id: agentSession.id }),
    ).toBeNull()
    expect(
      await repositories.extractionAgentSessionRepository.findOneBy({ id: otherRun.id }),
    ).not.toBeNull()
  })
})
