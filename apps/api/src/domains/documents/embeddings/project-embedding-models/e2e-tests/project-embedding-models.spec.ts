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
import { EMBEDDING_MODELS_FEATURE_DISABLED_ERROR_MESSAGE } from "../project-embedding-models.controller"
import {
  EMBEDDING_MODEL_ALREADY_PROCESSING_ERROR_MESSAGE,
  EMBEDDING_MODEL_NOT_CONFIGURED_ERROR_MESSAGE,
  EMBEDDING_MODEL_NOT_FOUND_ERROR_MESSAGE,
  EMBEDDING_MODEL_NOT_READY_ERROR_MESSAGE,
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
    // The routes only enable a model the deployment has an embedder for.
    process.env.EMBEDDER_BGE_M3_URL = "http://embedder.test"
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
        featureFlagKey: "embedding-models",
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

  const subjectSetDefault = async (projectEmbeddingModelId: string) =>
    request({
      route: ProjectEmbeddingModelsRoutes.updateOne,
      pathParams: removeNullish({ organizationId, projectId, projectEmbeddingModelId }),
      token: accessToken,
      request: { payload: { isDefault: true } },
    })

  it("enables a model on the project and enqueues the re-embedding job", async () => {
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

  it("rejects when the project does not have the embedding-models feature", async () => {
    await createContext({ withFeature: false })

    const response = await subject()

    expectResponse(response, 403, EMBEDDING_MODELS_FEATURE_DISABLED_ERROR_MESSAGE)
  })

  it("enables a Vertex model the project does not have yet", async () => {
    const { organization, project } = await createContext()
    await repositories.projectEmbeddingModelRepository.save(
      projectEmbeddingModelFactory.default().transient({ organization, project }).build(),
    )

    const response = await subject(EmbeddingModel.GeminiEmbedding001)

    expectResponse(response, 201)
    expect(response.body.data).toEqual(
      expect.objectContaining({ modelName: EmbeddingModel.GeminiEmbedding001, status: "pending" }),
    )
    expect(reembedBatchServiceMock.enqueueReembedProjectChunks).toHaveBeenCalledTimes(1)
  })

  it("rejects a model the deployment has no embedder for", async () => {
    await createContext()
    delete process.env.EMBEDDER_BGE_M3_URL

    const response = await subject()

    process.env.EMBEDDER_BGE_M3_URL = "http://embedder.test"
    expectResponse(response, 422, EMBEDDING_MODEL_NOT_CONFIGURED_ERROR_MESSAGE)
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

  it("gives a new project the deployment's models, ready and the first as default", async () => {
    await createContext()

    const response = await subjectGetAll()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([
      expect.objectContaining({
        projectId,
        modelName: EmbeddingModel.GeminiEmbedding001,
        status: "completed",
        isDefault: true,
      }),
    ])
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
        isDefault: false,
      }),
    ])
  })

  it("makes a completed model the project's default", async () => {
    const { organization, project } = await createContext()
    const previousDefault = await repositories.projectEmbeddingModelRepository.save(
      projectEmbeddingModelFactory
        .default()
        .transient({ organization, project })
        .build({ modelName: EmbeddingModel.GeminiEmbedding001 }),
    )
    const bgeM3 = await repositories.projectEmbeddingModelRepository.save(
      projectEmbeddingModelFactory.completed().transient({ organization, project }).build(),
    )

    const response = await subjectSetDefault(bgeM3.id)

    expectResponse(response, 200)
    expect(response.body.data).toEqual(expect.objectContaining({ id: bgeM3.id, isDefault: true }))
    const rows = await repositories.projectEmbeddingModelRepository.find({ where: { projectId } })
    expect(Object.fromEntries(rows.map((row) => [row.id, row.isDefault]))).toEqual({
      [previousDefault.id]: false,
      [bgeM3.id]: true,
    })
  })

  it("refuses to make a model still embedding the project the default", async () => {
    const { organization, project } = await createContext()
    const processing = await repositories.projectEmbeddingModelRepository.save(
      projectEmbeddingModelFactory
        .transient({ organization, project })
        .build({ status: "processing" }),
    )

    const response = await subjectSetDefault(processing.id)

    expectResponse(response, 422, EMBEDDING_MODEL_NOT_READY_ERROR_MESSAGE)
  })

  it("refuses to make another project's model the default", async () => {
    const { organization } = await createContext()
    const otherProject = await repositories.projectRepository.save(
      projectFactory.transient({ organization }).build(),
    )
    const otherModel = await repositories.projectEmbeddingModelRepository.save(
      projectEmbeddingModelFactory
        .completed()
        .transient({ organization, project: otherProject })
        .build(),
    )

    const response = await subjectSetDefault(otherModel.id)

    expectResponse(response, 404, EMBEDDING_MODEL_NOT_FOUND_ERROR_MESSAGE)
  })
})
