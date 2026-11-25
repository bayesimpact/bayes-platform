import { randomUUID } from "node:crypto"
import { AgentModel } from "@caseai-connect/api-contracts"
import {
  EvalExtractionRunsRoutes,
  type ExtractionRunInputDto,
} from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { evaluationExtractionDatasetFactory } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset.factory"
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

describe("Evaluation extraction runs - createOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

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
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
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

  /** A run of an extraction agent over a CSV dataset, pending until a test changes it. */
  const createContext = async (agentType: "conversation" | "extraction" = "extraction") => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
        projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
        agent: { type: agentType },
        agentSettings: {
          outputJsonSchema: { type: "object", properties: { answer: { type: "string" } } },
          model: AgentModel._Mock,
          instructions: "Published instructions",
        },
      },
    )
    organizationId = organization.id
    projectId = project.id
    const dataset = await repositories.evaluationExtractionDatasetRepository.save(
      evaluationExtractionDatasetFactory.transient({ organization, project }).build({
        schemaMapping: {},
      }),
    )
    const validPayload: ExtractionRunInputDto = {
      evaluationExtractionDatasetId: dataset.id,
      agentId: agent.id,
      agentSettingsRevision: null,
      keyMapping: [{ agentOutputKey: "answer", datasetColumnId: "col1", mode: "scored" }],
    }
    return { organization, project, agent, agentSettings, dataset, validPayload }
  }

  const subject = (payload: unknown) =>
    request({
      route: EvalExtractionRunsRoutes.createOne,
      pathParams: { organizationId, projectId },
      body: { payload },
      token: "token",
    })

  const expectNoRun = async () =>
    expect(await repositories.evaluationExtractionRunRepository.count()).toBe(0)

  it("creates a pending run on the version in production and records the activity", async () => {
    const { agent, agentSettings, dataset, validPayload } = await createContext()

    const response = await subject(validPayload)

    expectSchemaResponse(EvalExtractionRunsRoutes.createOne, response, 201)
    const runs = await repositories.evaluationExtractionRunRepository.find()
    expect(runs).toHaveLength(1)
    expect(response.body.data).toStrictEqual({
      id: runs[0]?.id,
      evaluationExtractionDatasetId: dataset.id,
      agentId: agent.id,
      agentRevision: agentSettings.revision,
      keyMapping: validPayload.keyMapping,
      status: "pending",
      summary: null,
      csvExportDocumentId: null,
      createdAt: runs[0]?.createdAt.getTime(),
      updatedAt: runs[0]?.updatedAt.getTime(),
    })
    expect(runs[0]?.agentSettingsId).toBe(agentSettings.id)
    await expectActivityCreated("evaluationExtractionRun.create", { organizationId, projectId })
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

    expectSchemaResponse(EvalExtractionRunsRoutes.createOne, response, 201)
    expect(response.body.data.agentRevision).toBe(agentSettings.revision)
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

    expectSchemaResponse(EvalExtractionRunsRoutes.createOne, response, 201)
    expect(response.body.data.agentRevision).toBe(2)
    const runs = await repositories.evaluationExtractionRunRepository.find()
    expect(runs[0]?.agentSettingsId).toBe(versionInProduction.id)
  })

  it("pins the requested saved version", async () => {
    const { organization, project, agent, agentSettings, validPayload } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ revision: 2, instructions: "Newer helpful assistant instructions" }),
    )

    const response = await subject({ ...validPayload, agentSettingsRevision: 1 })

    expectSchemaResponse(EvalExtractionRunsRoutes.createOne, response, 201)
    expect(response.body.data.agentRevision).toBe(1)
    const runs = await repositories.evaluationExtractionRunRepository.find()
    expect(runs[0]?.agentSettingsId).toBe(agentSettings.id)
  })

  it("answers 404 for a revision the agent does not have", async () => {
    const { validPayload } = await createContext()

    expectResponse(await subject({ ...validPayload, agentSettingsRevision: 999 }), 404)
    await expectNoRun()
  })

  it("answers 422 for a revision that is archived", async () => {
    const { organization, project, agent, validPayload } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ revision: 2, isArchived: true }),
    )

    expectResponse(await subject({ ...validPayload, agentSettingsRevision: 2 }), 422)
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

  // The schema takes any whole number: the handler keeps the range of a revision.
  it.each([0, -1, 2147483648])("answers 422 for the revision %s", async (revision) => {
    const { validPayload } = await createContext()

    expectResponse(await subject({ ...validPayload, agentSettingsRevision: revision }), 422)
    await expectNoRun()
  })

  it("answers 404 for an unknown dataset", async () => {
    const { validPayload } = await createContext()

    expectResponse(
      await subject({ ...validPayload, evaluationExtractionDatasetId: randomUUID() }),
      404,
    )
    await expectNoRun()
  })

  it("answers 404 for an unknown agent", async () => {
    const { validPayload } = await createContext()

    expectResponse(await subject({ ...validPayload, agentId: randomUUID() }), 404)
    await expectNoRun()
  })

  it("answers 422 for an agent that is not an extraction agent", async () => {
    const { validPayload } = await createContext("conversation")

    expectResponse(await subject(validPayload), 422)
    await expectNoRun()
  })

  // The old endpoint accepted these: the schema now refuses them.
  it("answers 400 for no field in the key mapping", async () => {
    const { validPayload } = await createContext()

    expectResponse(await subject({ ...validPayload, keyMapping: [] }), 400)
    await expectNoRun()
  })

  it("answers 400 for a dataset or an agent id that is not a UUID", async () => {
    const { validPayload } = await createContext()

    expectResponse(await subject({ ...validPayload, evaluationExtractionDatasetId: "x" }), 400)
    expectResponse(await subject({ ...validPayload, agentId: "x" }), 400)
    await expectNoRun()
  })

  it("answers 400 for a missing agentSettingsRevision, a revision with decimals and a field mode the API does not know", async () => {
    const { validPayload } = await createContext()
    const { agentSettingsRevision: _revision, ...withoutRevision } = validPayload

    expectResponse(await subject(withoutRevision), 400)
    expectResponse(await subject({ ...validPayload, agentSettingsRevision: 1.5 }), 400)
    expectResponse(
      await subject({
        ...validPayload,
        keyMapping: [{ agentOutputKey: "answer", datasetColumnId: "col1", mode: "other" }],
      }),
      400,
    )
    await expectNoRun()
  })
})
