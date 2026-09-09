import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { DocumentsModule } from "../documents.module"
import { DocumentsService } from "../documents.service"
import { FILE_STORAGE_SERVICE, type IFileStorage } from "../storage/file-storage.interface"
import { withDocumentEmbeddingsBatchServiceMock } from "../test-overrides"

export function documentsServiceTestSetup() {
  let service: DocumentsService
  let repositories: AllRepositories
  let fileStorageService: IFileStorage
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule],
      applyOverrides: withDocumentEmbeddingsBatchServiceMock,
    })
    service = setup.module.get<DocumentsService>(DocumentsService)
    fileStorageService = setup.module.get<IFileStorage>(FILE_STORAGE_SERVICE)
    repositories = setup.getAllRepositories()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  return () => {
    return { repositories, service, fileStorageService }
  }
}
