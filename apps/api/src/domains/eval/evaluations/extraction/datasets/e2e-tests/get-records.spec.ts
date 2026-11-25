import { randomUUID } from "node:crypto"
import { EvalExtractionDatasetsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { evaluationExtractionDatasetFactory } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset.factory"
import { evaluationExtractionDatasetRecordFactory } from "@/domains/evaluations/extraction/datasets/records/evaluation-extraction-dataset-record.factory"
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

describe("Evaluation extraction datasets - getRecords", () => {
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
    const dataset = await repositories.evaluationExtractionDatasetRepository.save(
      evaluationExtractionDatasetFactory.transient({ organization, project }).build({
        schemaMapping: {},
      }),
    )
    organizationId = organization.id
    projectId = project.id
    datasetId = dataset.id
    return { organization, project, dataset }
  }

  const saveRecords = async (
    context: Awaited<ReturnType<typeof createContext>>,
    rows: Record<string, string>[],
  ) => {
    const { organization, project, dataset } = context
    return repositories.evaluationExtractionDatasetRecordRepository.save(
      rows.map((data, index) =>
        evaluationExtractionDatasetRecordFactory
          .transient({ organization, project, evaluationExtractionDataset: dataset })
          .build({ data, createdAt: new Date(Date.UTC(2024, 0, index + 1)) }),
      ),
    )
  }

  const subject = (query: Record<string, string> = { page: "0", limit: "100" }) =>
    request({
      route: EvalExtractionDatasetsRoutes.getRecords,
      pathParams: { organizationId, projectId, datasetId },
      query,
      token: "token",
    })

  it("returns an empty page when the dataset has no record", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getRecords, response)
    expect(response.body.data).toStrictEqual({ records: [], total: 0, page: 0, limit: 100 })
  })

  it("returns one page of the records, in the order of the file", async () => {
    const context = await createContext()
    const records = await saveRecords(
      context,
      Array.from({ length: 5 }, (_value, index) => ({ col1: `Title ${index}` })),
    )

    const response = await subject({ page: "1", limit: "2" })

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getRecords, response)
    expect(response.body.data).toStrictEqual({
      records: records.slice(2, 4).map((record) => ({ id: record.id, data: record.data })),
      total: 5,
      page: 1,
      limit: 2,
    })
  })

  it("keeps the records whose columns hold every filter text", async () => {
    const context = await createContext()
    await saveRecords(context, [
      { col1: "Lung study", col2: "About treatment" },
      { col1: "Lung review", col2: "About diagnosis" },
      { col1: "Heart study", col2: "About treatment" },
    ])

    const response = await subject({
      page: "0",
      limit: "100",
      columnFilters: JSON.stringify({ col1: "lung", col2: "treatment" }),
    })

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getRecords, response)
    expect(response.body.data.total).toBe(1)
    expect(response.body.data.records[0]?.data.col1).toBe("Lung study")
  })

  it.each([
    ["asc", ["Apple", "Zebra"]],
    ["desc", ["Zebra", "Apple"]],
  ] as const)("sorts the records by a column, %s", async (sortOrder, expected) => {
    const context = await createContext()
    await saveRecords(context, [{ col1: "Zebra" }, { col1: "Apple" }])

    const response = await subject({ page: "0", limit: "100", sortBy: "col1", sortOrder })

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getRecords, response)
    expect(response.body.data.records.map((record) => record.data.col1)).toEqual(expected)
  })

  it("doesn't return the records of another dataset", async () => {
    const context = await createContext()
    await saveRecords(context, [{ col1: "Own" }])
    const otherDataset = await repositories.evaluationExtractionDatasetRepository.save(
      evaluationExtractionDatasetFactory
        .transient({ organization: context.organization, project: context.project })
        .build(),
    )
    await repositories.evaluationExtractionDatasetRecordRepository.save(
      evaluationExtractionDatasetRecordFactory
        .transient({
          organization: context.organization,
          project: context.project,
          evaluationExtractionDataset: otherDataset,
        })
        .build({ data: { col1: "Other" } }),
    )

    const response = await subject()

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getRecords, response)
    expect(response.body.data.records.map((record) => record.data.col1)).toEqual(["Own"])
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

  it("answers 400 for columnFilters that is not JSON", async () => {
    await createContext()
    expectResponse(await subject({ page: "0", limit: "100", columnFilters: "{not json" }), 400)
  })

  it("answers 400 for columnFilters that is not an object of texts", async () => {
    await createContext()
    expectResponse(await subject({ page: "0", limit: "100", columnFilters: '{"col1":3}' }), 400)
  })

  it("answers 400 for a sort order that is not asc or desc", async () => {
    await createContext()
    expectResponse(await subject({ page: "0", limit: "100", sortOrder: "up" }), 400)
  })
})
