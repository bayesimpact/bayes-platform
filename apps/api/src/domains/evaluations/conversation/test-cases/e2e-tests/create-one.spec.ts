import { randomUUID } from "node:crypto"
import {
  type CreateEvaluationConversationTestCaseRequestDto,
  EvaluationConversationTestCasesRoutes,
} from "@caseai-connect/api-contracts"
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
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationConversationDataset } from "../../datasets/evaluation-conversation-dataset.entity"
import { evaluationConversationDatasetFactory } from "../../datasets/evaluation-conversation-dataset.factory"
import { EvaluationConversationDatasetRecord } from "../../datasets/records/evaluation-conversation-dataset-record.entity"

describe("EvaluationConversationTestCases - createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let datasetRepository: Repository<EvaluationConversationDataset>
  let recordRepository: Repository<EvaluationConversationDatasetRecord>

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    datasetRepository = setup.getRepository(EvaluationConversationDataset)
    recordRepository = setup.getRepository(EvaluationConversationDatasetRecord)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!
    const dataset = evaluationConversationDatasetFactory
      .transient({ organization, project })
      .build()
    await datasetRepository.save(dataset)
    return { organization, project, dataset }
  }

  const subject = async (payload: Partial<CreateEvaluationConversationTestCaseRequestDto>) =>
    request({
      route: EvaluationConversationTestCasesRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: {
        payload: {
          datasetId: null,
          newDatasetName: null,
          input: "Can I switch to the monthly plan?",
          expectedOutput: "Yes, from Settings › Billing.",
          comment: null,
          ...payload,
        },
      },
    })

  it("saves the test case and its comment in an existing dataset", async () => {
    const { dataset } = await createContext()

    const res = await subject({ datasetId: dataset.id, comment: "  Says where to switch.  " })

    expectResponse(res, 201)
    const [record] = await recordRepository.find()
    expect(res.body.data).toEqual({ datasetId: dataset.id, recordId: record!.id })
    expect(record).toMatchObject({
      evaluationConversationDatasetId: dataset.id,
      organizationId,
      projectId,
      input: "Can I switch to the monthly plan?",
      expectedOutput: "Yes, from Settings › Billing.",
      comment: "Says where to switch.",
    })
  })

  it("creates the dataset when the test case goes to a new one", async () => {
    await createContext()

    const res = await subject({ newDatasetName: " Billing questions " })

    expectResponse(res, 201)
    const created = await datasetRepository.findOneByOrFail({ id: res.body.data.datasetId })
    expect(created).toMatchObject({ name: "Billing questions", organizationId, projectId })
    const [record] = await recordRepository.find()
    expect(record).toMatchObject({ evaluationConversationDatasetId: created.id, comment: null })
  })

  it("stores a blank comment as none", async () => {
    const { dataset } = await createContext()

    expectResponse(await subject({ datasetId: dataset.id, comment: "   " }), 201)

    const [record] = await recordRepository.find()
    expect(record!.comment).toBeNull()
  })

  it("does not save into a dataset of another project", async () => {
    const { dataset: otherDataset } = await createContext()
    await createContext()

    expectResponse(await subject({ datasetId: otherDataset.id }), 404)
    expectResponse(await subject({ datasetId: randomUUID() }), 404)
    expect(await recordRepository.count()).toBe(0)
  })

  it("rejects a blank input, a blank expected output or a new dataset without a name", async () => {
    const { dataset } = await createContext()

    expectResponse(await subject({ datasetId: dataset.id, input: " " }), 422)
    expectResponse(await subject({ datasetId: dataset.id, expectedOutput: " " }), 422)
    expectResponse(await subject({ newDatasetName: " " }), 422)
    expect(await recordRepository.count()).toBe(0)
    expect(await datasetRepository.count()).toBe(1)
  })
})
