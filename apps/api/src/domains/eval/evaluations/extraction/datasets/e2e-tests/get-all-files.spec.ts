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
import { evaluationExtractionDatasetDocumentFactory } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset-document.factory"
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

describe("Evaluation extraction datasets - getAllFiles", () => {
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
      route: EvalExtractionDatasetsRoutes.getAllFiles,
      pathParams: { organizationId, projectId },
      token: "token",
    })

  it("returns an empty list when the project has no file", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getAllFiles, response)
    expect(response.body.data).toStrictEqual([])
  })

  it("returns the confirmed files of the project, the newest first", async () => {
    const { organization, project } = await createContext()
    const otherProject = await repositories.projectRepository.save(
      projectFactory.transient({ organization }).build(),
    )
    const [olderFile, newerFile] =
      await repositories.evaluationExtractionDatasetDocumentRepository.save([
        evaluationExtractionDatasetDocumentFactory
          .transient({ organization, project })
          .build({ fileName: "older.csv", createdAt: new Date("2024-01-01") }),
        evaluationExtractionDatasetDocumentFactory
          .transient({ organization, project })
          .build({ fileName: "newer.csv", createdAt: new Date("2024-06-01") }),
      ])
    await repositories.evaluationExtractionDatasetDocumentRepository.save([
      evaluationExtractionDatasetDocumentFactory
        .transient({ organization, project })
        .build({ fileName: "pending.csv", uploadStatus: "pending" }),
      evaluationExtractionDatasetDocumentFactory
        .transient({ organization, project: otherProject })
        .build({ fileName: "foreign.csv" }),
    ])

    const response = await subject()

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getAllFiles, response)
    expect(response.body.data).toStrictEqual(
      [newerFile, olderFile].map((file) => ({
        id: file?.id,
        fileName: file?.fileName,
        size: file?.size,
        mimeType: "text/csv",
        createdAt: file?.createdAt.getTime(),
        updatedAt: file?.updatedAt.getTime(),
      })),
    )
  })
})
