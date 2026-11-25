import { randomUUID } from "node:crypto"
import { EvalConversationDatasetsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { evaluationConversationDatasetFactory } from "@/domains/evaluations/conversation/datasets/evaluation-conversation-dataset.factory"
import { evaluationConversationDatasetRecordFactory } from "@/domains/evaluations/conversation/datasets/records/evaluation-conversation-dataset-record.factory"
import {
  createOrganizationWithProject,
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

describe("Evaluation conversation datasets - getRecords", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let datasetId: string
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
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
      projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
    })
    const dataset = await repositories.evaluationConversationDatasetRepository.save(
      evaluationConversationDatasetFactory.transient({ organization, project }).build(),
    )
    organizationId = organization.id
    projectId = project.id
    datasetId = dataset.id
    return { organization, project, dataset }
  }

  const saveRecords = async (context: Awaited<ReturnType<typeof createContext>>, count: number) => {
    const { organization, project, dataset } = context
    const records = Array.from({ length: count }, (_value, index) =>
      evaluationConversationDatasetRecordFactory
        .transient({ organization, project, evaluationConversationDataset: dataset })
        .build({
          input: `Question ${index}`,
          expectedOutput: `Answer ${index}`,
          createdAt: new Date(Date.UTC(2024, 0, index + 1)),
        }),
    )
    return repositories.evaluationConversationDatasetRecordRepository.save(records)
  }

  const subject = (query: Record<string, string> = { page: "0", limit: "100" }) =>
    request({
      route: EvalConversationDatasetsRoutes.getRecords,
      pathParams: { organizationId, projectId, datasetId },
      query,
      token: "token",
    })

  it("returns an empty page when the dataset has no record", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalConversationDatasetsRoutes.getRecords, response)
    expect(response.body.data).toStrictEqual({ records: [], total: 0, page: 0, limit: 100 })
  })

  it("returns one page of the records, in the order they were added", async () => {
    const context = await createContext()
    const records = await saveRecords(context, 5)

    const response = await subject({ page: "1", limit: "2" })

    expectSchemaResponse(EvalConversationDatasetsRoutes.getRecords, response)
    expect(response.body.data).toStrictEqual({
      records: records.slice(2, 4).map((record) => ({
        id: record.id,
        input: record.input,
        expectedOutput: record.expectedOutput,
        comment: record.comment,
      })),
      total: 5,
      page: 1,
      limit: 2,
    })
  })

  it("doesn't return the records of another dataset", async () => {
    const context = await createContext()
    await saveRecords(context, 1)
    const otherDataset = await repositories.evaluationConversationDatasetRepository.save(
      evaluationConversationDatasetFactory
        .transient({ organization: context.organization, project: context.project })
        .build(),
    )
    await repositories.evaluationConversationDatasetRecordRepository.save(
      evaluationConversationDatasetRecordFactory
        .transient({
          organization: context.organization,
          project: context.project,
          evaluationConversationDataset: otherDataset,
        })
        .build({ input: "In the other dataset" }),
    )

    const response = await subject()

    expectSchemaResponse(EvalConversationDatasetsRoutes.getRecords, response)
    expect(response.body.data.total).toBe(1)
    expect(response.body.data.records.map((record) => record.input)).toEqual(["Question 0"])
  })

  it("answers 400 for an empty page", async () => {
    await createContext()
    expectResponse(await subject({ page: "", limit: "100" }), 400)
  })

  it("answers 400 when limit is over 100", async () => {
    await createContext()
    expectResponse(await subject({ page: "0", limit: "101" }), 400)
  })

  it("answers 400 without a page and a limit, which the old endpoint defaulted", async () => {
    await createContext()
    expectResponse(await subject({}), 400)
  })

  it("answers 400 for a page that is not a whole number", async () => {
    await createContext()
    expectResponse(await subject({ page: "1.5", limit: "100" }), 400)
  })
})
