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
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationConversationRun } from "../../runs/evaluation-conversation-run.entity"
import { evaluationConversationRunFactory } from "../../runs/evaluation-conversation-run.factory"
import { EvaluationConversationRunRecord } from "../../runs/records/evaluation-conversation-run-record.entity"
import { evaluationConversationRunRecordFactory } from "../../runs/records/evaluation-conversation-run-record.factory"
import { EvaluationConversationDataset } from "../evaluation-conversation-dataset.entity"
import { evaluationConversationDatasetFactory } from "../evaluation-conversation-dataset.factory"
import { EvaluationConversationDatasetRecord } from "../records/evaluation-conversation-dataset-record.entity"
import { evaluationConversationDatasetRecordFactory } from "../records/evaluation-conversation-dataset-record.factory"

describe("EvaluationConversationDatasets - deleteRecord", () => {
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
      .build()
    await recordRepository.save(record)
    recordId = record.id

    return { organization, project, dataset, record }
  }

  const subject = async () =>
    request({
      route: EvaluationConversationDatasetsRoutes.deleteRecord,
      pathParams: removeNullish({ organizationId, projectId, datasetId, recordId }),
      token: accessToken,
    })

  it("should delete the record", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toMatchObject({ success: true })

    const deletedRecord = await recordRepository.findOneBy({ id: recordId })
    expect(deletedRecord).toBeNull()
  })

  it("should not delete other records of the dataset", async () => {
    const { organization, project, dataset } = await createContext()

    const otherRecord = evaluationConversationDatasetRecordFactory
      .transient({ organization, project, evaluationConversationDataset: dataset })
      .build()
    await recordRepository.save(otherRecord)

    expectResponse(await subject())

    const remainingRecords = await recordRepository.find()
    expect(remainingRecords).toHaveLength(1)
    expect(remainingRecords[0]!.id).toBe(otherRecord.id)
  })

  it("keeps existing run records alive with a detached dataset record link", async () => {
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { agent: { type: "conversation" } },
    )
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
      .build()
    await recordRepository.save(record)
    recordId = record.id

    const run = evaluationConversationRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationConversationDataset: dataset,
      })
      .build({ status: "completed" })
    await setup.getRepository(EvaluationConversationRun).save(run)

    const runRecord = evaluationConversationRunRecordFactory
      .transient({
        organization,
        project,
        evaluationConversationRun: run,
        evaluationConversationDatasetRecord: record,
      })
      .build({ status: "graded", output: "answer", score: 90 })
    await setup.getRepository(EvaluationConversationRunRecord).save(runRecord)

    expectResponse(await subject())

    const deletedRecord = await recordRepository.findOneBy({ id: recordId })
    expect(deletedRecord).toBeNull()

    // The historical run record survives; only its dataset-record link is detached.
    const survivingRunRecord = await setup
      .getRepository(EvaluationConversationRunRecord)
      .findOneByOrFail({ id: runRecord.id })
    expect(survivingRunRecord.evaluationConversationDatasetRecordId).toBeNull()
    expect(survivingRunRecord.status).toBe("graded")
    expect(survivingRunRecord.input).toBe(record.input)
    expect(survivingRunRecord.expectedOutput).toBe(record.expectedOutput)
  })

  it("should return 404 for a non-existent record", async () => {
    await createContext()
    recordId = randomUUID()

    expectResponse(await subject(), 404)
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

    expectResponse(await subject(), 404)
  })
})
