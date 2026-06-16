import { randomUUID } from "node:crypto"
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
import { buildResource, createResourceLibraryForProject } from "../resource-library.factory"

describe("ResourceLibraries - downloadResourceFile (public)", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
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

  const seedLibraryWithFile = async (
    buildStoragePath: (ids: { orgId: string; projectId: string }) => string,
  ) => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const fileResource = buildResource({
      linkType: "file",
      file: {
        storageRelativePath: buildStoragePath({ orgId: organization.id, projectId: project.id }),
        fileName: "doc.pdf",
        mimeType: "application/pdf",
      },
    })
    const resourceLibrary = await createResourceLibraryForProject({
      repositories,
      organization,
      project,
      params: { resourceLibrary: { resources: [fileResource] } },
    })
    return { organization, project, resourceLibrary, fileResource }
  }

  it("redirects to a signed url for a valid file resource without auth", async () => {
    const { organization, project, resourceLibrary, fileResource } = await seedLibraryWithFile(
      ({ orgId, projectId }) => `${orgId}/${projectId}/doc.pdf`,
    )

    const path = ResourceLibrariesRoutes.downloadResourceFile.getPath({
      organizationId: organization.id,
      projectId: project.id,
      resourceLibraryId: resourceLibrary.id,
      resourceId: fileResource.id,
    })

    const response = await supertest(app.getHttpServer()).get(path).redirects(0)
    expect(response.status).toBe(302)
    expect(response.headers.location).toContain("doc.pdf")
  })

  it("returns 404 when the stored path is outside the project prefix", async () => {
    const { organization, project, resourceLibrary, fileResource } = await seedLibraryWithFile(
      () => "some-other-org/some-other-project/doc.pdf",
    )

    const path = ResourceLibrariesRoutes.downloadResourceFile.getPath({
      organizationId: organization.id,
      projectId: project.id,
      resourceLibraryId: resourceLibrary.id,
      resourceId: fileResource.id,
    })

    const response = await supertest(app.getHttpServer()).get(path).redirects(0)
    expect(response.status).toBe(404)
  })

  it("returns 404 for an unknown resource id", async () => {
    const { organization, project, resourceLibrary } = await seedLibraryWithFile(
      ({ orgId, projectId }) => `${orgId}/${projectId}/doc.pdf`,
    )

    const path = ResourceLibrariesRoutes.downloadResourceFile.getPath({
      organizationId: organization.id,
      projectId: project.id,
      resourceLibraryId: resourceLibrary.id,
      resourceId: randomUUID(),
    })

    const response = await supertest(app.getHttpServer()).get(path).redirects(0)
    expect(response.status).toBe(404)
  })
})
