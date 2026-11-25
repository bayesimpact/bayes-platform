import { randomUUID } from "node:crypto"
import {
  type ConversationDatasetRecordInputDto,
  EvalConversationDatasetsRoutes,
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

describe("Evaluation conversation datasets - updateRecord", () => {
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

  const createContext = async () => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
      projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
    })
    const dataset = await repositories.evaluationConversationDatasetRepository.save(
      evaluationConversationDatasetFactory.transient({ organization, project }).build(),
    )
    const record = await repositories.evaluationConversationDatasetRecordRepository.save(
      evaluationConversationDatasetRecordFactory
        .transient({ organization, project, evaluationConversationDataset: dataset })
        .build({ input: "Original question", expectedOutput: "Original answer" }),
    )
    organizationId = organization.id
    projectId = project.id
    datasetId = dataset.id
    recordId = record.id
    return { organization, project }
  }

  const subject = (payload: ConversationDatasetRecordInputDto) =>
    request({
      route: EvalConversationDatasetsRoutes.updateRecord,
      pathParams: { organizationId, projectId, datasetId, recordId },
      body: { payload },
      token: "token",
    })

  it("changes the record and records the activity", async () => {
    await createContext()

    const response = await subject({ input: "New question", expectedOutput: "New answer" })

    expectSchemaResponse(EvalConversationDatasetsRoutes.updateRecord, response)
    expect(response.body.data).toStrictEqual({ success: true })
    const record = await repositories.evaluationConversationDatasetRecordRepository.findOneByOrFail(
      { id: recordId },
    )
    expect(record).toMatchObject({ input: "New question", expectedOutput: "New answer" })
    await expectActivityCreated("evaluationConversationDataset.updateRecord", {
      organizationId,
      projectId,
    })
  })

  // The old endpoint answered 422 for a blank field: the schema now refuses it.
  it("answers 400 for a blank input and keeps the record", async () => {
    await createContext()

    expectResponse(await subject({ input: "   ", expectedOutput: "New answer" }), 400)
    const record = await repositories.evaluationConversationDatasetRecordRepository.findOneByOrFail(
      { id: recordId },
    )
    expect(record.input).toBe("Original question")
  })

  it("answers 400 for a blank expected output", async () => {
    await createContext()

    expectResponse(await subject({ input: "New question", expectedOutput: "   " }), 400)
  })

  it("answers 404 for a record of another dataset", async () => {
    const { organization, project } = await createContext()
    const otherDataset = await repositories.evaluationConversationDatasetRepository.save(
      evaluationConversationDatasetFactory.transient({ organization, project }).build(),
    )
    const otherRecord = await repositories.evaluationConversationDatasetRecordRepository.save(
      evaluationConversationDatasetRecordFactory
        .transient({ organization, project, evaluationConversationDataset: otherDataset })
        .build({ input: "Other question" }),
    )
    recordId = otherRecord.id

    expectResponse(await subject({ input: "New question", expectedOutput: "New answer" }), 404)
    const unchangedRecord =
      await repositories.evaluationConversationDatasetRecordRepository.findOneByOrFail({
        id: otherRecord.id,
      })
    expect(unchangedRecord.input).toBe("Other question")
  })
})
