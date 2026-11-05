import { randomUUID } from "node:crypto"
import { ProjectAppCatalogRoutes } from "@caseai-connect/api-contracts"
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
import {
  addFeature,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { projectFactory } from "@/domains/projects/project.factory"
import { mockForeignAuthSubject, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { APP_INSTALLATION_STATUS_REVOKED } from "../app-installation.entity"
import { appInstallationFactory } from "../app-installation.factory"
import { appManifestFactory } from "../app-manifest.factory"
import { AppsModule } from "../apps.module"
import { APPS_CATALOG_FEATURE_DISABLED_ERROR_MESSAGE } from "../project-app-catalog.controller"

describe("Apps - project app catalog", () => {
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

  const createContextForRole = async (
    role: ProjectRoleKey = "project_owner",
    { withFlag = true }: { withFlag?: boolean } = {},
  ) => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
      organizationMembership: { roleKeys: ["org_member"] },
      projectMembership: { roleKeys: [role] },
    })
    organizationId = organization.id
    projectId = project.id
    if (withFlag) {
      await addFeature({
        featureFlagRepository: repositories.featureFlagRepository,
        projectId: project.id,
        featureFlagKey: "apps-catalog",
      })
    }
    return { organization, project }
  }

  const saveManifest = async (params: Parameters<typeof appManifestFactory.build>[0]) => {
    const manifest = appManifestFactory.build(params)
    await repositories.appManifestRepository.save(manifest)
    return manifest
  }

  const subject = () =>
    request({
      route: ProjectAppCatalogRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken ?? undefined,
    })

  describe("auth", () => {
    it("requires an authentication token", async () => {
      await createContextForRole()
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole()
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it.each<ProjectRoleKey>([
      "project_owner",
      "project_admin",
      "project_member",
    ])("lets a %s see the catalog", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 200)
    })

    it("is forbidden when the project does not have the apps-catalog flag", async () => {
      await createContextForRole("project_owner", { withFlag: false })
      expectResponse(await subject(), 403, APPS_CATALOG_FEATURE_DISABLED_ERROR_MESSAGE)
    })
  })

  it("lists the apps listed in the catalog, by name, marking the installed ones", async () => {
    const { organization, project } = await createContextForRole()
    const crawler = await saveManifest({
      name: "Site Crawler",
      listedInCatalog: true,
      appUrl: "https://crawler.example.com",
      installInstructions: "Ask the Bayes team to open your access.",
      grantablePermissions: ["document.read", "project.read"],
    })
    const assistant = await saveManifest({ name: "Helpful Assistant", listedInCatalog: true })
    const revoked = await saveManifest({ name: "Messaging Channel", listedInCatalog: true })
    await saveManifest({ name: "Unlisted App", listedInCatalog: false })
    const otherProject = projectFactory.transient({ organization }).build()
    await repositories.projectRepository.save(otherProject)
    await repositories.appInstallationRepository.save([
      appInstallationFactory.build({ appManifestId: crawler.id, projectId: project.id }),
      appInstallationFactory.build({ appManifestId: assistant.id, projectId: otherProject.id }),
      appInstallationFactory.build({
        appManifestId: revoked.id,
        projectId: project.id,
        status: APP_INSTALLATION_STATUS_REVOKED,
        revokedAt: new Date(),
      }),
    ])

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([
      expect.objectContaining({ id: assistant.id, installed: false }),
      expect.objectContaining({ id: revoked.id, installed: false }),
      {
        id: crawler.id,
        name: "Site Crawler",
        description: crawler.description,
        logoUrl: null,
        appUrl: "https://crawler.example.com",
        installInstructions: "Ask the Bayes team to open your access.",
        grantablePermissions: ["document.read", "project.read"],
        installed: true,
      },
    ])
  })
})
