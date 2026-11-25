import { randomUUID } from "node:crypto"
import { EvalConversationDatasetsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
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
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../../test/schema-request"
import { EvalModule } from "../../../../eval.module"

describe("Evaluation conversation datasets - getAll", () => {
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
      route: EvalConversationDatasetsRoutes.getAll,
      pathParams: { organizationId, projectId },
      token: "token",
    })

  it("returns an empty list when the project has no dataset", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalConversationDatasetsRoutes.getAll, response)
    expect(response.body.data).toEqual([])
  })

  it("returns the datasets, newest first, with their record count", async () => {
    const { organization, project } = await createContext()
    const olderDataset = await repositories.evaluationConversationDatasetRepository.save(
      evaluationConversationDatasetFactory
        .transient({ organization, project })
        .build({ name: "Older questions", updatedAt: new Date("2024-01-01") }),
    )
    const newerDataset = await repositories.evaluationConversationDatasetRepository.save(
      evaluationConversationDatasetFactory
        .transient({ organization, project })
        .build({ name: "Newer questions", updatedAt: new Date("2024-06-01") }),
    )
    await repositories.evaluationConversationDatasetRecordRepository.save(
      evaluationConversationDatasetRecordFactory
        .transient({ organization, project, evaluationConversationDataset: newerDataset })
        .buildList(2),
    )

    const response = await subject()

    expectSchemaResponse(EvalConversationDatasetsRoutes.getAll, response)
    expect(response.body.data).toStrictEqual([
      {
        id: newerDataset.id,
        name: "Newer questions",
        recordCount: 2,
        updatedAt: newerDataset.updatedAt.getTime(),
      },
      {
        id: olderDataset.id,
        name: "Older questions",
        recordCount: 0,
        updatedAt: olderDataset.updatedAt.getTime(),
      },
    ])
  })
})
