import { randomUUID } from "node:crypto"
import { EvalConversationDatasetsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { evaluationConversationDatasetFactory } from "@/domains/evaluations/conversation/datasets/evaluation-conversation-dataset.factory"
import { evaluationConversationDatasetRecordFactory } from "@/domains/evaluations/conversation/datasets/records/evaluation-conversation-dataset-record.factory"
import { createRunWithConversationDataset } from "@/domains/evaluations/conversation/runs/e2e-tests/conversation-dataset.helpers"
import { evaluationConversationRunRecordFactory } from "@/domains/evaluations/conversation/runs/records/evaluation-conversation-run-record.factory"
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

describe("Evaluation conversation datasets - deleteRecord", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let datasetId: string
  let recordId: string
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

  /** A dataset of three records, with a completed run whose first record is graded. */
  const createContext = async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
        projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
        agent: { type: "conversation" },
      },
    )
    const { dataset, datasetRecords, run } = await createRunWithConversationDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
    })
    const [record, ...otherRecords] = datasetRecords
    if (!record) throw new Error("The helper saves three dataset records")
    const runRecord = await repositories.evaluationConversationRunRecordRepository.save(
      evaluationConversationRunRecordFactory
        .transient({
          organization,
          project,
          evaluationConversationRun: run,
          evaluationConversationDatasetRecord: record,
        })
        .build({ status: "graded", output: "An answer", score: 4 }),
    )
    organizationId = organization.id
    projectId = project.id
    datasetId = dataset.id
    recordId = record.id
    return { organization, project, record, otherRecords, runRecord }
  }

  const subject = () =>
    request({
      route: EvalConversationDatasetsRoutes.deleteRecord,
      pathParams: { organizationId, projectId, datasetId, recordId },
      token: "token",
    })

  it("deletes the record only, keeps the run record detached, and records the activity", async () => {
    const { record, otherRecords, runRecord } = await createContext()

    const response = await subject()

    expectSchemaResponse(EvalConversationDatasetsRoutes.deleteRecord, response)
    expect(response.body.data).toStrictEqual({ success: true })
    const remainingRecords = await repositories.evaluationConversationDatasetRecordRepository.find()
    expect(remainingRecords.map((remainingRecord) => remainingRecord.id).sort()).toEqual(
      otherRecords.map((otherRecord) => otherRecord.id).sort(),
    )
    const survivingRunRecord =
      await repositories.evaluationConversationRunRecordRepository.findOneByOrFail({
        id: runRecord.id,
      })
    expect(survivingRunRecord).toMatchObject({
      evaluationConversationDatasetRecordId: null,
      status: "graded",
      input: record.input,
    })
    await expectActivityCreated("evaluationConversationDataset.deleteRecord", {
      organizationId,
      projectId,
    })
  })

  it("answers 404 for a record of another dataset", async () => {
    const { organization, project } = await createContext()
    const otherDataset = await repositories.evaluationConversationDatasetRepository.save(
      evaluationConversationDatasetFactory.transient({ organization, project }).build(),
    )
    const otherRecord = await repositories.evaluationConversationDatasetRecordRepository.save(
      evaluationConversationDatasetRecordFactory
        .transient({ organization, project, evaluationConversationDataset: otherDataset })
        .build(),
    )
    recordId = otherRecord.id

    expectResponse(await subject(), 404)
    expect(
      await repositories.evaluationConversationDatasetRecordRepository.findOneBy({
        id: otherRecord.id,
      }),
    ).not.toBeNull()
  })
})
