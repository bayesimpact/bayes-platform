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
import {
  addFeature,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { DocumentsModule } from "../../../documents.module"
import { withDocumentAuthAndEmbeddingsMocks } from "../../../test-overrides"
import { projectEmbeddingModelFactory } from "../project-embedding-model.factory"
import { LOCAL_EMBEDDINGS_FEATURE_DISABLED_ERROR_MESSAGE } from "../project-embedding-models.controller"
import {
  EMBEDDING_MODEL_ALREADY_PROCESSING_ERROR_MESSAGE,
  EMBEDDING_MODEL_NOT_LOCAL_ERROR_MESSAGE,
} from "../project-embedding-models.service"
import {
  PROJECT_EMBEDDING_REEMBED_BATCH_SERVICE,
  type ProjectEmbeddingReembedBatchService,
} from "../project-embedding-reembed-batch.interface"

describe("Project Embedding Models", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"
  let reembedBatchServiceMock: {
    enqueueReembedProjectChunks: jest.MockedFunction<
      ProjectEmbeddingReembedBatchService["enqueueReembedProjectChunks"]
    >
  }

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule],
      applyOverrides: (moduleBuilder) =>
        withDocumentAuthAndEmbeddingsMocks(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    reembedBatchServiceMock = setup.module.get(PROJECT_EMBEDDING_REEMBED_BATCH_SERVICE)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = "oidc|123"
    reembedBatchServiceMock.enqueueReembedProjectChunks.mockClear()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async ({ withFeature = true }: { withFeature?: boolean } = {}) => {
    const { user, organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
    })
    if (withFeature) {
      await addFeature({
        featureFlagRepository: repositories.featureFlagRepository,
        projectId: project.id,
        featureFlagKey: "local-embeddings",
      })
    }
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject ?? authSubject
    return { organization, project }
  }

  const subjectGetAll = async () =>
    request({
      route: ProjectEmbeddingModelsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  const subject = async (modelName: EmbeddingModel = EmbeddingModel.BgeM3) =>
    request({
      route: ProjectEmbeddingModelsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: { payload: { modelName } },
    })

  it("enables a local model on the project and enqueues the re-embedding job", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 201)
    expect(response.body.data).toEqual(
      expect.objectContaining({
        projectId,
        modelName: EmbeddingModel.BgeM3,
        status: "pending",
        totalChunks: 0,
        processedChunks: 0,
        error: null,
      }),
    )
    const row = await repositories.projectEmbeddingModelRepository.findOne({
      where: { projectId, modelName: EmbeddingModel.BgeM3 },
    })
    expect(row?.status).toBe("pending")
    expect(reembedBatchServiceMock.enqueueReembedProjectChunks).toHaveBeenCalledWith({
      projectEmbeddingModelId: row?.id,
      organizationId,
      projectId,
      modelName: EmbeddingModel.BgeM3,
    })
  })

  it("rejects when the project does not have the local-embeddings feature", async () => {
    await createContext({ withFeature: false })

    const response = await subject()

    expectResponse(response, 403, LOCAL_EMBEDDINGS_FEATURE_DISABLED_ERROR_MESSAGE)
  })

  it("rejects the Vertex model, which every project already has", async () => {
    await createContext()

    const response = await subject(EmbeddingModel.GeminiEmbedding001)

    expectResponse(response, 400, EMBEDDING_MODEL_NOT_LOCAL_ERROR_MESSAGE)
  })

  it("rejects an unknown model name", async () => {
    await createContext()

    const response = await subject("not-a-model" as EmbeddingModel)

    expectResponse(response, 400)
  })

  it("refuses to enable a model that is already processing", async () => {
    const { organization, project } = await createContext()
    await repositories.projectEmbeddingModelRepository.save(
      projectEmbeddingModelFactory
        .transient({ organization, project })
        .build({ status: "processing" }),
    )

    const response = await subject()

    expectResponse(response, 409, EMBEDDING_MODEL_ALREADY_PROCESSING_ERROR_MESSAGE)
  })

  it("retries a failed model by resetting it to pending", async () => {
    const { organization, project } = await createContext()
    const failed = await repositories.projectEmbeddingModelRepository.save(
      projectEmbeddingModelFactory.failed().transient({ organization, project }).build(),
    )

    const response = await subject()

    expectResponse(response, 201)
    expect(response.body.data).toEqual(
      expect.objectContaining({ id: failed.id, status: "pending", error: null }),
    )
  })

  it("returns a completed model as is without a new job", async () => {
    const { organization, project } = await createContext()
    await repositories.projectEmbeddingModelRepository.save(
      projectEmbeddingModelFactory.completed().transient({ organization, project }).build(),
    )

    const response = await subject()

    expectResponse(response, 201)
    expect(response.body.data.status).toBe("completed")
  })

  it("returns an empty list when no local model was enabled", async () => {
    await createContext()

    const response = await subjectGetAll()

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
        .build({ modelName: EmbeddingModel.BgeM3 }),
    )

    const response = await subjectGetAll()

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
