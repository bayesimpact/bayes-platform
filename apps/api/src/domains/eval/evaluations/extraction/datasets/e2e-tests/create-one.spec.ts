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

describe("Evaluation extraction datasets - createOne", () => {
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

  const subject = (name: string) =>
    request({
      route: EvalExtractionDatasetsRoutes.createOne,
      pathParams: { organizationId, projectId },
      body: { payload: { name } },
      token: "token",
    })

  it("creates a dataset of the project without columns and records the activity", async () => {
    await createContext()

    const response = await subject("Product records")

    expectSchemaResponse(EvalExtractionDatasetsRoutes.createOne, response, 201)
    expect(response.body.data).toStrictEqual({ success: true })
    const datasets = await repositories.evaluationExtractionDatasetRepository.find()
    expect(datasets).toHaveLength(1)
    expect(datasets[0]).toMatchObject({
      name: "Product records",
      organizationId,
      projectId,
      schemaMapping: {},
    })
    await expectActivityCreated("evaluationExtractionDataset.create", { organizationId, projectId })
  })

  // The old endpoint answered 422 for a blank name: the schema now refuses it.
  it("answers 400 for a blank name and creates nothing", async () => {
    await createContext()

    expectResponse(await subject("   "), 400)
    expect(await repositories.evaluationExtractionDatasetRepository.count()).toBe(0)
  })
})
