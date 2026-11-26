import { randomUUID } from "node:crypto"
import {
  EvalReviewCampaignsRoutes,
  type UpdateReviewCampaignInputDto,
} from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation review campaigns - updateOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
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
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** A project with an agent and a campaign of the given status. */
  const createContext = async (status: "draft" | "active" = "draft") => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      (status === "active" ? reviewCampaignFactory.active() : reviewCampaignFactory)
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    return { organization, project, agent, agentSettings, campaign }
  }

  const subject = (payload: UpdateReviewCampaignInputDto) =>
    request({
      route: EvalReviewCampaignsRoutes.updateOne,
      pathParams: { organizationId, projectId, reviewCampaignId },
      body: { payload },
      token: "token",
    })

  it("updates the configuration while in draft", async () => {
    await createContext()

    const response = await subject({
      name: "Renamed",
      description: "How the Helpful Assistant answers",
      reviewerQuestions: [
        {
          id: "rv-1",
          prompt: "Pick a tag",
          type: "single-choice",
          required: true,
          options: ["Product", "Pricing"],
        },
      ],
    })

    expectSchemaResponse(EvalReviewCampaignsRoutes.updateOne, response)
    expect(response.body.data).toMatchObject({
      id: reviewCampaignId,
      name: "Renamed",
      description: "How the Helpful Assistant answers",
      reviewerQuestions: [
        {
          id: "rv-1",
          prompt: "Pick a tag",
          type: "single-choice",
          required: true,
          options: ["Product", "Pricing"],
        },
      ],
    })
    const persisted = await repositories.reviewCampaignRepository.findOneByOrFail({
      id: reviewCampaignId,
    })
    expect(persisted.name).toBe("Renamed")
  })

  it("moves a draft campaign to another saved version of its agent", async () => {
    const { organization, project, agent } = await createContext()
    const olderVersion = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent }).build({ revision: 7 }),
    )

    const response = await subject({ agentSettingsId: olderVersion.id })

    expectSchemaResponse(EvalReviewCampaignsRoutes.updateOne, response)
    expect(response.body.data.agentSettingsId).toBe(olderVersion.id)
  })

  it("refuses to move a draft campaign to the agent's draft", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    const draft = await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .draft()
        .transient({ organization, project, agent })
        .build({ revision: 7 }),
    )

    expectResponse(await subject({ agentSettingsId: draft.id }), 422)
    const persisted = await repositories.reviewCampaignRepository.findOneByOrFail({
      id: reviewCampaignId,
    })
    expect(persisted.agentSettingsId).toBe(agentSettings.id)
  })

  it("refuses to change the version of an active campaign", async () => {
    const { organization, project, agent } = await createContext("active")
    const olderVersion = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent }).build({ revision: 7 }),
    )

    expectResponse(await subject({ agentSettingsId: olderVersion.id }), 409)
  })

  it("refuses configuration updates on an active campaign", async () => {
    await createContext("active")
    expectResponse(await subject({ name: "Renamed" }), 409)
  })

  it("answers 400 for an agent id, which the old route took to retarget a draft", async () => {
    const { agent } = await createContext()
    expectResponse(
      await request({
        route: EvalReviewCampaignsRoutes.updateOne,
        pathParams: { organizationId, projectId, reviewCampaignId },
        body: { payload: { agentId: agent.id } },
        token: "token",
      }),
      400,
    )
  })

  it("answers 400 for a blank name, which the old handler refused with a 422", async () => {
    await createContext()
    expectResponse(await subject({ name: "   " }), 400)
  })

  it("moves a draft campaign to active", async () => {
    await createContext()

    const response = await subject({ status: "active" })

    expectSchemaResponse(EvalReviewCampaignsRoutes.updateOne, response)
    expect(response.body.data.status).toBe("active")
    const persisted = await repositories.reviewCampaignRepository.findOneByOrFail({
      id: reviewCampaignId,
    })
    expect(persisted.activatedAt).not.toBeNull()
  })

  it("moves an active campaign to closed", async () => {
    await createContext("active")

    const response = await subject({ status: "closed" })

    expectSchemaResponse(EvalReviewCampaignsRoutes.updateOne, response)
    expect(response.body.data.status).toBe("closed")
    const persisted = await repositories.reviewCampaignRepository.findOneByOrFail({
      id: reviewCampaignId,
    })
    expect(persisted.closedAt).not.toBeNull()
  })

  it("refuses to close a draft campaign", async () => {
    await createContext()
    expectResponse(await subject({ status: "closed" }), 409)
  })
})
