import { randomUUID } from "node:crypto"
import { EvaluationExtractionDatasetsRoutes } from "@caseai-connect/api-contracts"
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
import { EvaluationExtractionDataset } from "../../datasets/evaluation-extraction-dataset.entity"
import { evaluationExtractionDatasetFactory } from "../../datasets/evaluation-extraction-dataset.factory"
import { EvaluationExtractionDatasetRecord } from "../records/evaluation-extraction-dataset-record.entity"
import { evaluationExtractionDatasetRecordFactory } from "../records/evaluation-extraction-dataset-record.factory"

describe("EvaluationExtractionDatasets - deleteOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let datasetRepository: Repository<EvaluationExtractionDataset>
  let recordRepository: Repository<EvaluationExtractionDatasetRecord>

  let organizationId: string
  let projectId: string
  let datasetId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    datasetRepository = setup.getRepository(EvaluationExtractionDataset)
    recordRepository = setup.getRepository(EvaluationExtractionDatasetRecord)
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

    const dataset = evaluationExtractionDatasetFactory.transient({ organization, project }).build()
    await datasetRepository.save(dataset)
    datasetId = dataset.id

    return { organization, project, dataset }
  }

  const subject = async () =>
    request({
      route: EvaluationExtractionDatasetsRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, datasetId }),
      token: accessToken,
    })

  it("should delete the dataset", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toMatchObject({ success: true })

    const deletedDataset = await datasetRepository.findOneBy({ id: datasetId })
    expect(deletedDataset).toBeNull()
  })

  it("should cascade delete the dataset records", async () => {
    const { organization, project, dataset } = await createContext()

    const records = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .buildList(3)
    await recordRepository.save(records)

    expectResponse(await subject())

    const remainingRecords = await recordRepository.findBy({
      evaluationExtractionDatasetId: datasetId,
    })
    expect(remainingRecords).toHaveLength(0)
  })

  it("should return 404 for a non-existent dataset", async () => {
    await createContext()
    datasetId = randomUUID()

    expectResponse(await subject(), 404)
  })
})
