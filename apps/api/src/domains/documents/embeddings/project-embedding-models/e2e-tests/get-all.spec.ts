import { EmbeddingModel, ProjectEmbeddingModelsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { DocumentsModule } from "../../../documents.module"
import { withDocumentAuthAndEmbeddingsMocks } from "../../../test-overrides"
import { projectEmbeddingModelFactory } from "../project-embedding-model.factory"

describe("Project Embedding Models - getAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule],
      applyOverrides: (moduleBuilder) =>
        withDocumentAuthAndEmbeddingsMocks(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
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
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
    })
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    return { organization, project }
  }

  const subject = async () =>
    request({
      route: ProjectEmbeddingModelsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  it("returns an empty list when no local model was enabled", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })

  it("lists the project's models with their progress, and not another project's", async () => {
    const { organization, project } = await createContext()
    const otherProject = await repositories.projectRepository.save(
      projectFactory.transient({ organization }).build(),
    )
    const processing = await repositories.projectEmbeddingModelRepository.save(
      projectEmbeddingModelFactory
        .transient({ organization, project })
        .build({ status: "processing", totalChunks: 40, processedChunks: 12 }),
    )
    await repositories.projectEmbeddingModelRepository.save(
      projectEmbeddingModelFactory
        .completed()
        .transient({ organization, project: otherProject })
        .build({ modelName: EmbeddingModel.EmbeddingGemma300m }),
    )

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([
      expect.objectContaining({
        id: processing.id,
        projectId,
        modelName: EmbeddingModel.BgeM3,
        status: "processing",
        totalChunks: 40,
        processedChunks: 12,
        error: null,
      }),
    ])
  })
})
