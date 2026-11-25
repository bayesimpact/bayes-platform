import { randomUUID } from "node:crypto"
import {
  type CreateReviewCampaignInputDto,
  EvalReviewCampaignsRoutes,
} from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation review campaigns - createOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
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

  const createContext = async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    organizationId = organization.id
    projectId = project.id
    return { organization, project, agent, agentSettings }
  }

  const campaignInput = (
    fields: Partial<CreateReviewCampaignInputDto> & { agentId: string },
  ): CreateReviewCampaignInputDto => ({
    name: "Helpful Assistant review",
    description: null,
    testerPerSessionQuestions: [],
    testerEndOfPhaseQuestions: [],
    reviewerQuestions: [],
    ...fields,
  })

  const subject = (payload: CreateReviewCampaignInputDto) =>
    request({
      route: EvalReviewCampaignsRoutes.createOne,
      pathParams: { organizationId, projectId },
      body: { payload },
      token: "token",
    })

  it("creates a campaign in draft status", async () => {
    const { agent } = await createContext()
    const response = await subject(
      campaignInput({
        agentId: agent.id,
        name: "  My Campaign  ",
        description: "A campaign of the Helpful Assistant",
        testerPerSessionQuestions: [
          { id: "q-1", prompt: "Was the agent helpful?", type: "rating", required: true },
        ],
      }),
    )

    expectSchemaResponse(EvalReviewCampaignsRoutes.createOne, response, 201)
    expect(response.body.data).toMatchObject({
      organizationId,
      projectId,
      name: "My Campaign",
      description: "A campaign of the Helpful Assistant",
      status: "draft",
      agentId: agent.id,
      testerPerSessionQuestions: [
        { id: "q-1", prompt: "Was the agent helpful?", type: "rating", required: true },
      ],
      testerEndOfPhaseQuestions: [],
      reviewerQuestions: [],
    })
    const persisted = await repositories.reviewCampaignRepository.findOneByOrFail({
      id: response.body.data.id,
    })
    expect(persisted).toMatchObject({ status: "draft", activatedAt: null, closedAt: null })
  })

  it("runs on the version in production when no version is given", async () => {
    const { agent, agentSettings } = await createContext()
    const response = await subject(campaignInput({ agentId: agent.id }))
    expectSchemaResponse(EvalReviewCampaignsRoutes.createOne, response, 201)
    expect(response.body.data.agentSettingsId).toBe(agentSettings.id)
  })

  it("runs on the saved version the manager chose", async () => {
    const { organization, project, agent } = await createContext()
    const olderVersion = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent }).build({ revision: 7 }),
    )

    const response = await subject(
      campaignInput({ agentId: agent.id, agentSettingsId: olderVersion.id }),
    )
    expectSchemaResponse(EvalReviewCampaignsRoutes.createOne, response, 201)
    expect(response.body.data.agentSettingsId).toBe(olderVersion.id)
    const persisted = await repositories.reviewCampaignRepository.findOneByOrFail({
      id: response.body.data.id,
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
      await subject(campaignInput({ agentId: agent.id, agentSettingsId: draft.id })),
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
      await subject(campaignInput({ agentId: agent.id, agentSettingsId: archived.id })),
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
      await subject(campaignInput({ agentId: agent.id, agentSettingsId: otherVersion.id })),
      404,
    )
  })

  it("answers 400 for a blank name, which the old handler refused with a 422", async () => {
    const { agent } = await createContext()
    expectResponse(await subject(campaignInput({ agentId: agent.id, name: "  " })), 400)
    expect(await repositories.reviewCampaignRepository.count()).toBe(0)
  })

  it("answers 400 for a single-choice question with less than two options", async () => {
    const { agent } = await createContext()
    expectResponse(
      await subject(
        campaignInput({
          agentId: agent.id,
          reviewerQuestions: [
            {
              id: "q-1",
              prompt: "Pick a tag",
              type: "single-choice",
              required: true,
              options: ["Product"],
            },
          ],
        }),
      ),
      400,
    )
  })

  it("rejects an agent from another project", async () => {
    await createContext()
    const { organization: otherOrganization, project: otherProject } =
      await createOrganizationWithProject(repositories)
    const otherAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization: otherOrganization, project: otherProject }).build(),
    )

    expectResponse(await subject(campaignInput({ agentId: otherAgent.id })), 422)
  })

  it("rejects an agent that was never published, such as a fresh copy", async () => {
    const { agent } = await createContext()
    await repositories.agentSettingsRepository.update(
      { agentId: agent.id },
      { isDraft: true, isProduction: false },
    )

    expectResponse(
      await subject(campaignInput({ agentId: agent.id })),
      422,
      `Agent ${agent.id} has no published version: publish it before reviewing it in a campaign`,
    )
    expect(await repositories.reviewCampaignRepository.count()).toBe(0)
  })
})
