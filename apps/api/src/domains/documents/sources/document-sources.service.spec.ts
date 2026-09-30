import { ConflictException, NotFoundException } from "@nestjs/common"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createDocumentForProject } from "@/domains/documents/document.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { DocumentsModule } from "../documents.module"
import { DocumentSourcesService } from "./document-sources.service"

describe("DocumentSourcesService", () => {
  let service: DocumentSourcesService
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule],
    })
    service = setup.module.get(DocumentSourcesService)
    repositories = setup.getAllRepositories()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  const createFeed = (
    connectScope: { organizationId: string; projectId: string },
    externalId: string | null,
  ) =>
    service.createOne(connectScope, {
      name: "Site crawler",
      type: "site-crawler",
      externalId,
      baseUrl: "https://example.com",
      config: { depth: 1 },
    })

  it("creates two feeds when external id is omitted", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }

    const first = await createFeed(connectScope, null)
    const second = await createFeed(connectScope, null)

    expect(first.id).not.toBe(second.id)
    expect(first.config).toEqual({ depth: 1 })
  })

  it("rejects a duplicate external id in the same project", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }
    await createFeed(connectScope, "folder-1")

    await expect(createFeed(connectScope, "folder-1")).rejects.toBeInstanceOf(ConflictException)
  })

  it("does not return a feed from another project", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const other = await createOrganizationWithProject(repositories)
    const created = await createFeed(
      { organizationId: organization.id, projectId: project.id },
      "folder-1",
    )

    const found = await service.getOne(
      { organizationId: other.organization.id, projectId: other.project.id },
      created.id,
    )
    expect(found).toBeNull()
    await expect(
      service.deleteOne(
        { organizationId: other.organization.id, projectId: other.project.id },
        created.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it("rejects delete while documents are still attached", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const documentSource = await createFeed(connectScope, "folder-1")
    const document = await createDocumentForProject({
      repositories,
      organization,
      project,
    })
    await repositories.documentRepository.update(document.id, {
      documentSourceId: documentSource.id,
    })

    await expect(service.deleteOne(connectScope, documentSource.id)).rejects.toBeInstanceOf(
      ConflictException,
    )
    await expect(service.getOne(connectScope, documentSource.id)).resolves.toMatchObject({
      id: documentSource.id,
    })
  })

  it("summarizes document count, last sync, and status", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const readySource = await createFeed(connectScope, "ready-feed")
    const errorSource = await service.createOne(connectScope, {
      name: "Broken feed",
      type: null,
      externalId: "broken-feed",
      baseUrl: null,
      config: null,
    })
    const emptySource = await service.createOne(connectScope, {
      name: "Empty feed",
      type: "folder",
      externalId: "empty-feed",
      baseUrl: null,
      config: null,
    })

    const older = new Date("2026-01-01T00:00:00.000Z")
    const newer = new Date("2026-02-01T00:00:00.000Z")
    await createDocumentForProject({
      repositories,
      organization,
      project,
      params: {
        document: {
          documentSourceId: readySource.id,
          embeddingStatus: "completed",
          createdAt: older,
          sourceType: "app",
        },
      },
    })
    await createDocumentForProject({
      repositories,
      organization,
      project,
      params: {
        document: {
          documentSourceId: readySource.id,
          embeddingStatus: "completed",
          createdAt: newer,
          sourceType: "app",
        },
      },
    })
    await createDocumentForProject({
      repositories,
      organization,
      project,
      params: {
        document: {
          documentSourceId: errorSource.id,
          embeddingStatus: "failed",
          createdAt: newer,
          sourceType: "app",
        },
      },
    })
    await createDocumentForProject({
      repositories,
      organization,
      project,
      params: {
        document: {
          documentSourceId: errorSource.id,
          embeddingStatus: "completed",
          createdAt: older,
          sourceType: "app",
        },
      },
    })

    const summaries = await service.listSummaries(connectScope)
    const ready = summaries.find((summary) => summary.id === readySource.id)
    const broken = summaries.find((summary) => summary.id === errorSource.id)
    const empty = summaries.find((summary) => summary.id === emptySource.id)

    expect(ready).toMatchObject({
      documentCount: 2,
      indexedDocumentCount: 2,
      status: "ready",
      baseUrl: "https://example.com",
      type: "site-crawler",
    })
    expect(ready?.lastSyncedAt?.toISOString()).toBe(newer.toISOString())
    expect(broken).toMatchObject({
      documentCount: 2,
      indexedDocumentCount: 1,
      status: "error",
    })
    expect(empty).toMatchObject({
      documentCount: 0,
      indexedDocumentCount: 0,
      lastSyncedAt: null,
      status: "ready",
      type: "folder",
    })
  })
})
