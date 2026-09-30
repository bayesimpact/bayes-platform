import { AgentModel, EvaluationExtractionRunsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import type { Repository } from "typeorm"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationExtractionDataset } from "../../datasets/evaluation-extraction-dataset.entity"
import { evaluationExtractionDatasetFactory } from "../../datasets/evaluation-extraction-dataset.factory"
import { EvaluationExtractionRun } from "../evaluation-extraction-run.entity"

describe("EvaluationExtractionRuns - createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let evaluationExtractionRunRepository: Repository<EvaluationExtractionRun>
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    evaluationExtractionRunRepository = setup.getRepository(EvaluationExtractionRun)
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  const createContext = async (agentType?: "conversation" | "extraction" | undefined) => {
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { type: agentType ?? "extraction" },
        agentSettings: {
          outputJsonSchema: { type: "object", properties: { age: { type: "string" } } },
          model: AgentModel._Mock,
        },
      },
    )
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const dataset = evaluationExtractionDatasetFactory
      .transient({ organization, project })
      .build({ schemaMapping: {} })
    await setup.getRepository(EvaluationExtractionDataset).save(dataset)

    return { organization, project, dataset, agent, agentSettings }
  }

  const subject = async (payload?: typeof EvaluationExtractionRunsRoutes.createOne.request) =>
    request({
      route: EvaluationExtractionRunsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  it("should create an evaluation run with valid data", async () => {
    const { dataset, agent, agentSettings } = await createContext()

    const res = await subject({
      payload: {
        evaluationExtractionDatasetId: dataset.id,
        agentId: agent.id,
        agentSettingsRevision: null,
        keyMapping: [{ agentOutputKey: "age", datasetColumnId: "col1", mode: "scored" }],
      },
    })

    expectResponse(res, 201)
    expect(res.body.data.status).toBe("pending")
    expect(res.body.data.evaluationExtractionDatasetId).toBe(dataset.id)
    expect(res.body.data.agentId).toBe(agent.id)
    expect(res.body.data.agentSettingsId).toBe(agentSettings.id)
    expect(res.body.data.agentRevision).toBe(agentSettings.revision)
    expect(res.body.data.summary).toBeNull()

    const runs = await evaluationExtractionRunRepository.find()
    expect(runs).toHaveLength(1)
    await expectActivityCreated("evaluationExtractionRun.create")
  })

  it("should pin the latest published agent settings revision on the run when agentSettingsRevision is null", async () => {
    const { organization, project, dataset, agent } = await createContext()
    const newerSettings = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision: 2, instructions: "Newer helpful assistant instructions" })
    await repositories.agentSettingsRepository.save(newerSettings)

    const res = await subject({
      payload: {
        evaluationExtractionDatasetId: dataset.id,
        agentId: agent.id,
        agentSettingsRevision: null,
        keyMapping: [{ agentOutputKey: "age", datasetColumnId: "col1", mode: "scored" }],
      },
    })

    expectResponse(res, 201)
    expect(res.body.data.agentRevision).toBe(2)
    const runs = await evaluationExtractionRunRepository.find()
    expect(runs[0]!.agentSettingsId).toBe(newerSettings.id)
  })

  it("should pin the requested agent settings revision on the run", async () => {
    const { organization, project, dataset, agent, agentSettings } = await createContext()
    const newerSettings = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision: 2, instructions: "Newer helpful assistant instructions" })
    await repositories.agentSettingsRepository.save(newerSettings)

    const res = await subject({
      payload: {
        evaluationExtractionDatasetId: dataset.id,
        agentId: agent.id,
        agentSettingsRevision: 1,
        keyMapping: [{ agentOutputKey: "age", datasetColumnId: "col1", mode: "scored" }],
      },
    })

    expectResponse(res, 201)
    expect(res.body.data.agentRevision).toBe(1)
    expect(res.body.data.agentSettingsId).toBe(agentSettings.id)
    const runs = await evaluationExtractionRunRepository.find()
    expect(runs[0]!.agentSettingsId).toBe(agentSettings.id)
  })

  it("should reject if the requested agent settings revision does not exist", async () => {
    const { dataset, agent } = await createContext()

    const res = await subject({
      payload: {
        evaluationExtractionDatasetId: dataset.id,
        agentId: agent.id,
        agentSettingsRevision: 999,
        keyMapping: [],
      },
    })

    expectResponse(res, 404)
    const runs = await evaluationExtractionRunRepository.find()
    expect(runs).toHaveLength(0)
  })

  it("should reject if the requested agent settings revision is archived", async () => {
    const { organization, project, dataset, agent } = await createContext()
    const archivedSettings = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision: 2, isArchived: true })
    await repositories.agentSettingsRepository.save(archivedSettings)

    const res = await subject({
      payload: {
        evaluationExtractionDatasetId: dataset.id,
        agentId: agent.id,
        agentSettingsRevision: 2,
        keyMapping: [],
      },
    })

    expectResponse(res, 422)
    const runs = await evaluationExtractionRunRepository.find()
    expect(runs).toHaveLength(0)
  })

  it("should reject if the requested agent settings revision is out of range", async () => {
    const { dataset, agent } = await createContext()

    const res = await subject({
      payload: {
        evaluationExtractionDatasetId: dataset.id,
        agentId: agent.id,
        // One past the Postgres int4 upper bound.
        agentSettingsRevision: 2147483648,
        keyMapping: [],
      },
    })

    expectResponse(res, 422)
    const runs = await evaluationExtractionRunRepository.find()
    expect(runs).toHaveLength(0)
  })

  it("should reject if dataset does not exist", async () => {
    const { agent } = await createContext()

    const res = await subject({
      payload: {
        evaluationExtractionDatasetId: "00000000-0000-0000-0000-000000000000",
        agentId: agent.id,
        agentSettingsRevision: null,
        keyMapping: [],
      },
    })

    expectResponse(res, 404)
  })

  it("should reject if agent does not exist", async () => {
    const { dataset } = await createContext()

    const res = await subject({
      payload: {
        evaluationExtractionDatasetId: dataset.id,
        agentId: "00000000-0000-0000-0000-000000000000",
        agentSettingsRevision: null,
        keyMapping: [],
      },
    })

    expectResponse(res, 404)
  })

  it("should reject if agent is not an extraction type", async () => {
    const { dataset, agent } = await createContext("conversation")

    const res = await subject({
      payload: {
        evaluationExtractionDatasetId: dataset.id,
        agentId: agent.id,
        agentSettingsRevision: null,
        keyMapping: [],
      },
    })

    expectResponse(res, 422)
  })
})
