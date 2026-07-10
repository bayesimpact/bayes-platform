import type { Repository } from "typeorm"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { Organization } from "@/domains/organizations/organization.entity"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { Project } from "@/domains/projects/project.entity"
import { User } from "@/domains/users/user.entity"
import { Document } from "../document.entity"
import { DocumentsController } from "../documents.controller"
import { DocumentsModule } from "../documents.module"
import { FILE_STORAGE_SERVICE, type IFileStorage } from "../storage/file-storage.interface"
import { withDocumentEmbeddingsBatchServiceMock } from "../test-overrides"

export function documentsControllerTestSetup() {
  let controller: DocumentsController
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let userRepository: Repository<User>
  let organizationRepository: Repository<Organization>
  let projectRepository: Repository<Project>
  let documentRepository: Repository<Document>
  let fileStorageService: IFileStorage
  let organization: Organization

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule],
      applyOverrides: withDocumentEmbeddingsBatchServiceMock,
    })
    await clearTestDatabase(setup.dataSource)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    controller = setup.module.get<DocumentsController>(DocumentsController)
    fileStorageService = setup.module.get<IFileStorage>(FILE_STORAGE_SERVICE)
    userRepository = setup.getRepository(User)
    organizationRepository = setup.getRepository(Organization)
    projectRepository = setup.getRepository(Project)
    documentRepository = setup.getRepository(Document)

    const org = organizationFactory.build({ name: "Org1" })
    organization = await organizationRepository.save(org)
  })

  afterEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  it("should be defined", () => {
    expect(controller).toBeDefined()
  })

  return () => {
    return {
      organizationRepository,
      userRepository,
      projectRepository,
      documentRepository,
      fileStorageService,
      controller,
      organization,
    }
  }
}
