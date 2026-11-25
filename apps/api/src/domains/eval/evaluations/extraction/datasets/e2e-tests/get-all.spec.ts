import { randomUUID } from "node:crypto"
import { EvalExtractionDatasetsRoutes } from "@caseai-connect/eval-contracts"
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
import { projectFactory } from "@/domains/projects/project.factory"
import { setupUserGuardForTesting } from "../../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../../test/schema-request"
import { EvalModule } from "../../../../eval.module"

describe("Evaluation extraction datasets - getAll", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

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

  const subject = () =>
    request({
      route: EvalExtractionDatasetsRoutes.getAll,
      pathParams: { organizationId, projectId },
      token: "token",
    })

  it("returns an empty list when the project has no dataset", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getAll, response)
    expect(response.body.data).toStrictEqual([])
  })

  it("returns the datasets with their columns and record count, the newest first", async () => {
    const { organization, project } = await createContext()
    const schemaMapping = {
      col1: { id: "col1", index: 0, originalName: "title", finalName: "Title", role: "input" },
    } as const
    const olderDataset = await repositories.evaluationExtractionDatasetRepository.save(
      evaluationExtractionDatasetFactory
        .transient({ organization, project })
        .build({ name: "Older", updatedAt: new Date("2024-01-01") }),
    )
    const newerDataset = await repositories.evaluationExtractionDatasetRepository.save(
      evaluationExtractionDatasetFactory
        .transient({ organization, project })
        .build({ name: "Newer", schemaMapping, updatedAt: new Date("2024-06-01") }),
    )
    await repositories.evaluationExtractionDatasetRecordRepository.save(
      evaluationExtractionDatasetRecordFactory
        .transient({ organization, project, evaluationExtractionDataset: newerDataset })
        .buildList(2, { data: { col1: "Sample title" } }),
    )

    const response = await subject()

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getAll, response)
    expect(response.body.data).toStrictEqual([
      {
        id: newerDataset.id,
        name: "Newer",
        recordCount: 2,
        schemaMapping,
        updatedAt: newerDataset.updatedAt.getTime(),
      },
      {
        id: olderDataset.id,
        name: "Older",
        recordCount: 0,
        schemaMapping: olderDataset.schemaMapping,
        updatedAt: olderDataset.updatedAt.getTime(),
      },
    ])
  })

  it("doesn't return the datasets of another project", async () => {
    const { organization } = await createContext()
    const otherProject = await repositories.projectRepository.save(
      projectFactory.transient({ organization }).build(),
    )
    await repositories.evaluationExtractionDatasetRepository.save(
      evaluationExtractionDatasetFactory.transient({ organization, project: otherProject }).build(),
    )

    const response = await subject()

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getAll, response)
    expect(response.body.data).toStrictEqual([])
  })
})
