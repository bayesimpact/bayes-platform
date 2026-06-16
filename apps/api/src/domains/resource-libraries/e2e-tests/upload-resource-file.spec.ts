import { ResourceLibrariesRoutes } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import supertest from "supertest"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ResourceLibrariesModule } from "../resource-libraries.module"

describe("ResourceLibraries - uploadResourceFile", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ResourceLibrariesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async (role: "owner" | "admin" | "member" = "owner") => {
    const { user, organization, project } = await createOrganizationWithProject(repositories, {
      projectMembership: { role },
    })
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    return { organization, project }
  }

  const uploadFile = (contentType = "application/pdf") => {
    const path = ResourceLibrariesRoutes.uploadResourceFile.getPath({ organizationId, projectId })
    return supertest(app.getHttpServer())
      .post(path)
      .set("Authorization", "Bearer token")
      .attach("file", Buffer.from("%PDF-1.4 minimal"), {
        filename: "handbook.pdf",
        contentType,
      })
  }

  it("stores the file under the project prefix and returns its metadata", async () => {
    await createContext()

    const response = await uploadFile()

    expect(response.status).toBe(201)
    expect(response.body.data.fileName).toBe("handbook.pdf")
    expect(response.body.data.mimeType).toBe("application/pdf")
    expect(response.body.data.storageRelativePath).toContain(`${organizationId}/${projectId}/`)
  })

  it("forbids a simple member from uploading", async () => {
    await createContext("member")
    const response = await uploadFile()
    expect(response.status).toBe(403)
  })
})
