import { randomUUID } from "node:crypto"
import { AgentModel } from "@bayes-platform/api-contracts"
import {
  CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH,
  type ConversationRunInputDto,
  EvalConversationRunsRoutes,
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
import { evaluationConversationDatasetFactory } from "@/domains/evaluations/conversation/datasets/evaluation-conversation-dataset.factory"
import {
  createOrganizationWithAgent,
  OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
} from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../../test/schema-request"
import { EvalModule } from "../../../../eval.module"

describe("Evaluation conversation runs - createOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
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

  const createContext = async (agentType: "conversation" | "extraction" = "conversation") => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
        projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
        agent: { type: agentType },
        agentSettings: { model: AgentModel._Mock },
      },
    )
    const dataset = await repositories.evaluationConversationDatasetRepository.save(
      evaluationConversationDatasetFactory.transient({ organization, project }).build(),
    )
    organizationId = organization.id
    projectId = project.id
    const validPayload: ConversationRunInputDto = {
      agentId: agent.id,
      agentSettingsRevision: null,
      datasetId: dataset.id,
      judgeModel: AgentModel.Gemini35Flash,
      judgeInstructions: null,
    }
    return { organization, project, agent, agentSettings, dataset, validPayload }
  }

  const subject = (payload: ConversationRunInputDto) =>
    request({
      route: EvalConversationRunsRoutes.createOne,
      pathParams: { organizationId, projectId },
      body: { payload },
      token: "token",
    })

  const expectNoRun = async () =>
    expect(await repositories.evaluationConversationRunRepository.count()).toBe(0)

  it("creates a pending run on the version in production", async () => {
    const { agent, agentSettings, dataset, validPayload } = await createContext()

    const response = await subject(validPayload)

    expectSchemaResponse(EvalConversationRunsRoutes.createOne, response, 201)
    const runs = await repositories.evaluationConversationRunRepository.find()
    expect(runs).toHaveLength(1)
    expect(response.body.data).toStrictEqual({
      id: runs[0]?.id,
      evaluationConversationDatasetId: dataset.id,
      agentId: agent.id,
      agentSettings: {
        instructions: agentSettings.instructions,
        model: agentSettings.model,
        revision: agentSettings.revision,
        providerOptions: agentSettings.providerOptions,
        documentsRagMode: agentSettings.documentsRagMode,
      },
      status: "pending",
      judgeModel: AgentModel.Gemini35Flash,
      judgeInstructions: null,
      summary: null,
      createdAt: runs[0]?.createdAt.getTime(),
      updatedAt: runs[0]?.updatedAt.getTime(),
    })
    expect(runs[0]?.agentSettingsId).toBe(agentSettings.id)
  })

  it("records evaluationConversationRun.create once", async () => {
    const { validPayload } = await createContext()

    expectSchemaResponse(EvalConversationRunsRoutes.createOne, await subject(validPayload), 201)

    const activities = await repositories.activityRepository.findBy({
      action: "evaluationConversationRun.create",
    })
    expect(activities).toHaveLength(1)
    expect(activities[0]).toMatchObject({ organizationId, projectId })
  })

  it("trims the judge instructions and stores blank ones as null", async () => {
    const { validPayload } = await createContext()

    const response = await subject({
      ...validPayload,
      judgeInstructions: "  Grade strictly on factual accuracy.  ",
    })
    const blankResponse = await subject({ ...validPayload, judgeInstructions: "   " })

    expectSchemaResponse(EvalConversationRunsRoutes.createOne, response, 201)
    expect(response.body.data.judgeInstructions).toBe("Grade strictly on factual accuracy.")
    expectSchemaResponse(EvalConversationRunsRoutes.createOne, blankResponse, 201)
    expect(blankResponse.body.data.judgeInstructions).toBeNull()
    const runs = await repositories.evaluationConversationRunRepository.find({
      order: { createdAt: "ASC" },
    })
    expect(runs.map((run) => run.judgeInstructions)).toEqual([
      "Grade strictly on factual accuracy.",
      null,
    ])
  })

  it("pins the requested saved version", async () => {
    const { organization, project, agent, agentSettings, validPayload } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ revision: 2, instructions: "Newer helpful assistant instructions" }),
    )

    const response = await subject({ ...validPayload, agentSettingsRevision: 1 })

    expectSchemaResponse(EvalConversationRunsRoutes.createOne, response, 201)
    expect(response.body.data.agentSettings.revision).toBe(1)
    expect(response.body.data.agentSettings.instructions).toBe(agentSettings.instructions)
    const [run] = await repositories.evaluationConversationRunRepository.find()
    expect(run?.agentSettingsId).toBe(agentSettings.id)
  })

  it("pins the version in production when it is not the first one", async () => {
    const { organization, project, agent, agentSettings, validPayload } = await createContext()
    await repositories.agentSettingsRepository.update(agentSettings.id, { isProduction: false })
    const versionInProduction = await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .production()
        .transient({ organization, project, agent })
        .build({ revision: 2, instructions: "Newer helpful assistant instructions" }),
    )

    const response = await subject(validPayload)

    expectSchemaResponse(EvalConversationRunsRoutes.createOne, response, 201)
    expect(response.body.data.agentSettings.revision).toBe(2)
    const [run] = await repositories.evaluationConversationRunRepository.find()
    expect(run?.agentSettingsId).toBe(versionInProduction.id)
  })

  it("pins the version in production, not a newer draft, without a revision", async () => {
    const { organization, project, agent, agentSettings, validPayload } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .draft()
        .transient({ organization, project, agent })
        .build({ revision: 2 }),
    )

    const response = await subject(validPayload)

    expectSchemaResponse(EvalConversationRunsRoutes.createOne, response, 201)
    expect(response.body.data.agentSettings.revision).toBe(agentSettings.revision)
  })

  it("answers 404 for a revision the agent does not have", async () => {
    const { validPayload } = await createContext()

    expectResponse(await subject({ ...validPayload, agentSettingsRevision: 999 }), 404)
    await expectNoRun()
  })

  it("answers 422 for a revision that is a draft", async () => {
    const { organization, project, agent, validPayload } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .draft()
        .transient({ organization, project, agent })
        .build({ revision: 2 }),
    )

    expectResponse(
      await subject({ ...validPayload, agentSettingsRevision: 2 }),
      422,
      "Revision 2 is a draft and cannot be evaluated",
    )
    await expectNoRun()
  })

  it("answers 400 for a judge model behind a feature flag the project lacks", async () => {
    const { validPayload } = await createContext()

    expectResponse(await subject({ ...validPayload, judgeModel: AgentModel.Gemma4_26B }), 400)
    await expectNoRun()
  })

  it("answers 400 for a judge model past its deprecation date", async () => {
    const { validPayload } = await createContext()

    expectResponse(await subject({ ...validPayload, judgeModel: AgentModel.Gemini25Pro }), 400)
    await expectNoRun()
  })

  it("answers 422 for a judge model that does not exist", async () => {
    const { validPayload } = await createContext()

    expectResponse(await subject({ ...validPayload, judgeModel: "not-a-real-model" }), 422)
    await expectNoRun()
  })

  it("answers 404 for an unknown dataset", async () => {
    const { validPayload } = await createContext()

    expectResponse(await subject({ ...validPayload, datasetId: randomUUID() }), 404)
    await expectNoRun()
  })

  it("answers 404 for an unknown agent", async () => {
    const { validPayload } = await createContext()

    expectResponse(await subject({ ...validPayload, agentId: randomUUID() }), 404)
    await expectNoRun()
  })

  it("answers 422 for an agent that is not a conversation agent", async () => {
    const { validPayload } = await createContext("extraction")

    expectResponse(await subject(validPayload), 422)
    await expectNoRun()
  })

  // The old endpoint answered 422 for these: the schema now refuses them.
  it("answers 400 for judge instructions over the longest length", async () => {
    const { validPayload } = await createContext()

    const judgeInstructions = "a".repeat(CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH + 1)
    expectResponse(await subject({ ...validPayload, judgeInstructions }), 400)
    await expectNoRun()
  })

  it("answers 400 for judge instructions that are not a text", async () => {
    const { validPayload } = await createContext()

    const response = await request({
      route: EvalConversationRunsRoutes.createOne,
      pathParams: { organizationId, projectId },
      body: { payload: { ...validPayload, judgeInstructions: 123 } },
      token: "token",
    })

    expectResponse(response, 400)
    await expectNoRun()
  })
})
