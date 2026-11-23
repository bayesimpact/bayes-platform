import { randomUUID } from "node:crypto"
import { ReviewCampaignsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { ReviewCampaignsModule } from "../review-campaigns.module"

describe("ReviewCampaigns - createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let accessToken: string = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ReviewCampaignsModule],
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

  const createContext = async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    organizationId = organization.id
    projectId = project.id
    return { organization, project, agent, agentSettings }
  }

  const subject = async (payload: typeof ReviewCampaignsRoutes.createOne.request) =>
    request({
      route: ReviewCampaignsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  it("creates a campaign in draft status", async () => {
    const { agent } = await createContext()
    const response = await subject({ payload: { agentId: agent.id, name: "My Campaign" } })
    expectResponse(response, 201)
    expect(response.body.data).toMatchObject({
      name: "My Campaign",
      status: "draft",
      agentId: agent.id,
      activatedAt: null,
      closedAt: null,
    })

    const persisted = await repositories.reviewCampaignRepository.findOne({
      where: { id: response.body.data.id },
    })
    expect(persisted).not.toBeNull()
  })

  it("runs on the version in production when no version is given", async () => {
    const { agent, agentSettings } = await createContext()
    const response = await subject({ payload: { agentId: agent.id, name: "My Campaign" } })
    expectResponse(response, 201)
    expect(response.body.data.agentSettingsId).toBe(agentSettings.id)
  })

  it("runs on the saved version the manager chose", async () => {
    const { organization, project, agent } = await createContext()
    const olderVersion = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent }).build({ revision: 7 }),
    )

    const response = await subject({
      payload: { agentId: agent.id, agentSettingsId: olderVersion.id, name: "My Campaign" },
    })
    expectResponse(response, 201)
    expect(response.body.data.agentSettingsId).toBe(olderVersion.id)
    const persisted = await repositories.reviewCampaignRepository.findOneOrFail({
      where: { id: response.body.data.id },
    })
    expect(persisted.agentSettingsId).toBe(olderVersion.id)
  })

  it("refuses the agent's draft", async () => {
    const { organization, project, agent } = await createContext()
    const draft = await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .draft()
        .transient({ organization, project, agent })
        .build({ revision: 7 }),
    )

    expectResponse(
      await subject({ payload: { agentId: agent.id, agentSettingsId: draft.id, name: "Draft" } }),
      422,
      "A campaign runs on a saved version of the agent, not its draft",
    )
  })

  it("refuses an archived version", async () => {
    const { organization, project, agent } = await createContext()
    const archived = await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .archived()
        .transient({ organization, project, agent })
        .build({ revision: 7 }),
    )

    expectResponse(
      await subject({
        payload: { agentId: agent.id, agentSettingsId: archived.id, name: "Archived" },
      }),
      422,
    )
  })

  it("refuses a version of another agent", async () => {
    const { organization, project, agent } = await createContext()
    const otherAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build(),
    )
    const otherVersion = await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .production()
        .transient({ organization, project, agent: otherAgent })
        .build(),
    )

    expectResponse(
      await subject({
        payload: { agentId: agent.id, agentSettingsId: otherVersion.id, name: "Other" },
      }),
      404,
    )
  })

  it("rejects an empty name", async () => {
    const { agent } = await createContext()
    expectResponse(await subject({ payload: { agentId: agent.id, name: "  " } }), 422)
  })

  it("rejects an agent from another project", async () => {
    await createContext()
    const { organization: otherOrg, project: otherProject } =
      await createOrganizationWithProject(repositories)
    const otherAgent = agentFactory
      .transient({ organization: otherOrg, project: otherProject })
      .build()
    await repositories.agentRepository.save(otherAgent)

    expectResponse(await subject({ payload: { agentId: otherAgent.id, name: "Bad" } }), 422)
  })

  it("rejects an agent that was never published, such as a fresh copy", async () => {
    const { agent } = await createContext()
    await repositories.agentSettingsRepository.update(
      { agentId: agent.id },
      { isDraft: true, isProduction: false },
    )

    expectResponse(
      await subject({ payload: { agentId: agent.id, name: "Copy Campaign" } }),
      422,
      `Agent ${agent.id} has no published version: publish it before reviewing it in a campaign`,
    )
    expect(await repositories.reviewCampaignRepository.count()).toBe(0)
  })
})
