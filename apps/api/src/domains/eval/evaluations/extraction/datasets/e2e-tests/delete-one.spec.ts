import { randomUUID } from "node:crypto"
import { EvalExtractionDatasetsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
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

describe("Evaluation extraction datasets - deleteOne", () => {
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

  const createContext = async () => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
      projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
    })
    organizationId = organization.id
    projectId = project.id
    return { organization, project }
  }

  const createDataset = async () => {
    const { organization, project } = await createContext()
    const dataset = await repositories.evaluationExtractionDatasetRepository.save(
      evaluationExtractionDatasetFactory.transient({ organization, project }).build(),
    )
    return { organization, project, dataset }
  }

  const subject = (datasetId: string) =>
    request({
      route: EvalExtractionDatasetsRoutes.deleteOne,
      pathParams: { organizationId, projectId, datasetId },
      token: "token",
    })

  it("deletes the dataset with its records and records the activity", async () => {
    const { organization, project, dataset } = await createDataset()
    await repositories.evaluationExtractionDatasetRecordRepository.save(
      evaluationExtractionDatasetRecordFactory
        .transient({ organization, project, evaluationExtractionDataset: dataset })
        .buildList(3),
    )

    const response = await subject(dataset.id)

    expectSchemaResponse(EvalExtractionDatasetsRoutes.deleteOne, response)
    expect(response.body.data).toStrictEqual({ success: true })
    expect(await repositories.evaluationExtractionDatasetRepository.count()).toBe(0)
    expect(await repositories.evaluationExtractionDatasetRecordRepository.count()).toBe(0)
    await expectActivityCreated("evaluationExtractionDataset.delete", { organizationId, projectId })
  })

  it("answers 404 for an unknown dataset", async () => {
    await createDataset()
    expectResponse(await subject(randomUUID()), 404)
  })
})
