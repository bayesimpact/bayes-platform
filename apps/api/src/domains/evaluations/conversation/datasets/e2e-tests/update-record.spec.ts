import { randomUUID } from "node:crypto"
import { EvaluationConversationDatasetsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import type { Repository } from "typeorm"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationConversationDataset } from "../evaluation-conversation-dataset.entity"
import { evaluationConversationDatasetFactory } from "../evaluation-conversation-dataset.factory"
import { EvaluationConversationDatasetRecord } from "../records/evaluation-conversation-dataset-record.entity"
import { evaluationConversationDatasetRecordFactory } from "../records/evaluation-conversation-dataset-record.factory"

describe("EvaluationConversationDatasets - updateRecord", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let datasetRepository: Repository<EvaluationConversationDataset>
  let recordRepository: Repository<EvaluationConversationDatasetRecord>

  let organizationId: string
  let projectId: string
  let datasetId: string
  let recordId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    datasetRepository = setup.getRepository(EvaluationConversationDataset)
    recordRepository = setup.getRepository(EvaluationConversationDatasetRecord)
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

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const dataset = evaluationConversationDatasetFactory
      .transient({ organization, project })
      .build()
    await datasetRepository.save(dataset)
    datasetId = dataset.id

    const record = evaluationConversationDatasetRecordFactory
      .transient({ organization, project, evaluationConversationDataset: dataset })
      .build({ input: "Original question", expectedOutput: "Original expected answer" })
    await recordRepository.save(record)
    recordId = record.id

    return { organization, project, dataset, record }
  }

  const subject = async (
    payload?: typeof EvaluationConversationDatasetsRoutes.updateRecord.request,
  ) =>
    request({
      route: EvaluationConversationDatasetsRoutes.updateRecord,
      pathParams: removeNullish({ organizationId, projectId, datasetId, recordId }),
      token: accessToken,
      request: payload,
    })

  it("should update the record input and expected output", async () => {
    await createContext()

    const res = await subject({
      payload: { input: "Updated question", expectedOutput: "Updated expected answer" },
    })

    expectResponse(res)
    expect(res.body.data).toMatchObject({ success: true })

    const updatedRecord = await recordRepository.findOneBy({ id: recordId })
    expect(updatedRecord!.input).toBe("Updated question")
    expect(updatedRecord!.expectedOutput).toBe("Updated expected answer")
  })

  it("should reject an empty input", async () => {
    await createContext()

    const res = await subject({
      payload: { input: "   ", expectedOutput: "Updated expected answer" },
    })

    expectResponse(res, 422)
  })

  it("should reject an empty expected output", async () => {
    await createContext()

    const res = await subject({ payload: { input: "Updated question", expectedOutput: "   " } })

    expectResponse(res, 422)
  })

  it("should return 404 for a non-existent record", async () => {
    await createContext()
    recordId = randomUUID()

    const res = await subject({
      payload: { input: "Updated question", expectedOutput: "Updated expected answer" },
    })

    expectResponse(res, 404)
  })

  it("should return 404 for a record belonging to another dataset", async () => {
    const { organization, project } = await createContext()

    const otherDataset = evaluationConversationDatasetFactory
      .transient({ organization, project })
      .build()
    await datasetRepository.save(otherDataset)

    const otherRecord = evaluationConversationDatasetRecordFactory
      .transient({ organization, project, evaluationConversationDataset: otherDataset })
      .build()
    await recordRepository.save(otherRecord)
    recordId = otherRecord.id

    const res = await subject({
      payload: { input: "Updated question", expectedOutput: "Updated expected answer" },
    })

    expectResponse(res, 404)
  })
})
