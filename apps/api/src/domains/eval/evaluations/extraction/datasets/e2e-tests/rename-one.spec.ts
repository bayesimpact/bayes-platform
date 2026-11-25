import { randomUUID } from "node:crypto"
import { EvalExtractionDatasetsRoutes } from "@caseai-connect/eval-contracts"
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
import {
  createOrganizationWithProject,
  OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
} from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { setupUserGuardForTesting } from "../../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../../test/schema-request"
import { EvalModule } from "../../../../eval.module"

describe("Evaluation extraction datasets - renameOne", () => {
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
    return repositories.evaluationExtractionDatasetRepository.save(
      evaluationExtractionDatasetFactory.transient({ organization, project }).build(),
    )
  }

  const subject = (datasetId: string, name: string) =>
    request({
      route: EvalExtractionDatasetsRoutes.renameOne,
      pathParams: { organizationId, projectId, datasetId },
      body: { payload: { name } },
      token: "token",
    })

  it("renames the dataset and records the activity", async () => {
    const dataset = await createDataset()

    const response = await subject(dataset.id, "Pricing records")

    expectSchemaResponse(EvalExtractionDatasetsRoutes.renameOne, response)
    expect(response.body.data).toStrictEqual({ success: true })
    const renamed = await repositories.evaluationExtractionDatasetRepository.findOneByOrFail({
      id: dataset.id,
    })
    expect(renamed.name).toBe("Pricing records")
    await expectActivityCreated("evaluationExtractionDataset.rename", { organizationId, projectId })
  })

  // The old endpoint answered 422 for a blank name: the schema now refuses it.
  it("answers 400 for a blank name and keeps the name", async () => {
    const dataset = await createDataset()

    expectResponse(await subject(dataset.id, "   "), 400)

    const unchanged = await repositories.evaluationExtractionDatasetRepository.findOneByOrFail({
      id: dataset.id,
    })
    expect(unchanged.name).toBe(dataset.name)
  })

  it("answers 404 for a dataset of another project", async () => {
    const { organization } = await createContext()
    const otherProject = await repositories.projectRepository.save(
      projectFactory.transient({ organization }).build(),
    )
    const otherDataset = await repositories.evaluationExtractionDatasetRepository.save(
      evaluationExtractionDatasetFactory.transient({ organization, project: otherProject }).build(),
    )

    expectResponse(await subject(otherDataset.id, "Pricing records"), 404)
  })
})
