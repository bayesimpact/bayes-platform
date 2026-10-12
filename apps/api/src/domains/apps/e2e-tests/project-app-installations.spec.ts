import { randomUUID } from "node:crypto"
import { ProjectAppInstallationsRoutes } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { withDocumentEmbeddingsBatchServiceMock } from "@/domains/documents/test-overrides"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { APP_INSTALLATION_STATUS_REVOKED } from "../app-installation.entity"
import { appInstallationFactory } from "../app-installation.factory"
import { appManifestFactory } from "../app-manifest.factory"
import { AppsModule } from "../apps.module"

type ProjectRole = "owner" | "admin" | "member"

describe("Apps - project app installations", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | null = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AppsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(
          withDocumentEmbeddingsBatchServiceMock(moduleBuilder),
          () => authSubject,
        ),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
    organizationId = randomUUID()
    projectId = randomUUID()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: ProjectRole = "owner") => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
      organizationMembership: { role: "member" },
      projectMembership: { role },
    })
    organizationId = organization.id
    projectId = project.id
    return { organization, project }
  }

  const installApp = async (
    targetProjectId: string,
    params: { name: string; status?: typeof APP_INSTALLATION_STATUS_REVOKED },
  ) => {
    const manifest = appManifestFactory.build({ name: params.name })
    await repositories.appManifestRepository.save(manifest)
    const installation = appInstallationFactory.build({
      appManifestId: manifest.id,
      projectId: targetProjectId,
      clientId: randomUUID(),
      ...(params.status ? { status: params.status, revokedAt: new Date() } : {}),
    })
    await repositories.appInstallationRepository.save(installation)
    return installation
  }

  /** Switches the caller to an organization admin who holds no role on the project. */
  const switchToOrganizationAdminWithoutProjectRole = async (organization: Organization) => {
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    await addUserToOrganization({
      repositories,
      organization,
      user: {
        authSubject: organizationAdminAuthSubject,
        email: mockOidcEmailForSub(organizationAdminAuthSubject),
      },
      membership: { role: "admin" },
    })
    authSubject = organizationAdminAuthSubject
  }

  const subject = () =>
    request({
      route: ProjectAppInstallationsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken ?? undefined,
    })

  describe("auth", () => {
    it("requires an authentication token", async () => {
      await createContextForRole("owner")
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it.each<ProjectRole>([
      "owner",
      "admin",
    ])("allows a project %s to list the apps", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 200)
    })

    it("forbids a simple project member", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("forbids an organization admin without a project role", async () => {
      const { organization } = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(organization)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  it("returns the active apps of the project, newest first", async () => {
    const { project } = await createContextForRole("owner")
    const first = await installApp(project.id, { name: "Helpful Assistant" })
    await repositories.appInstallationRepository.update(
      { id: first.id },
      { createdAt: new Date(Date.now() - 60_000) },
    )
    const second = await installApp(project.id, { name: "Site Crawler" })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([
      expect.objectContaining({ id: second.id, appName: "Site Crawler", permissions: [] }),
      expect.objectContaining({ id: first.id, appName: "Helpful Assistant", permissions: [] }),
    ])
  })

  it("leaves out revoked apps and apps of another project", async () => {
    const { organization, project } = await createContextForRole("owner")
    const otherProject = projectFactory.transient({ organization }).build()
    await repositories.projectRepository.save(otherProject)
    await installApp(project.id, { name: "Revoked App", status: APP_INSTALLATION_STATUS_REVOKED })
    await installApp(otherProject.id, { name: "Other Project App" })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })
})
