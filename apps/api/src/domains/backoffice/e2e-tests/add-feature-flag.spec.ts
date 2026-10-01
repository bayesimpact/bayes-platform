import { randomUUID } from "node:crypto"
import { BackofficeRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformStaffToUser,
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - feature flag lifecycle", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [BackofficeModule, RbacModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createAuthorizedContext = async () => {
    const email = mockOidcEmailForSub(authSubject)
    const context = await createOrganizationWithProject(repositories, {
      user: { authSubject, email },
    })
    await assignPlatformSuperadminToUser({ repositories, user: context.user })
    return context
  }

  it("adds a feature flag to a project", async () => {
    const { project } = await createAuthorizedContext()
    const response = await request({
      route: BackofficeRoutes.addFeatureFlag,
      pathParams: { projectId: project.id },
      token: "token",
      request: { payload: { featureFlagKey: "evaluation" } },
    })
    expectResponse(response, 201)
    const flag = await repositories.featureFlagRepository.findOne({
      where: { projectId: project.id, featureFlagKey: "evaluation" },
    })
    expect(flag).not.toBeNull()
    expect(flag?.enabled).toBe(true)
  })

  it("is idempotent when the same flag is added twice", async () => {
    const { project } = await createAuthorizedContext()
    await request({
      route: BackofficeRoutes.addFeatureFlag,
      pathParams: { projectId: project.id },
      token: "token",
      request: { payload: { featureFlagKey: "evaluation" } },
    })
    const response = await request({
      route: BackofficeRoutes.addFeatureFlag,
      pathParams: { projectId: project.id },
      token: "token",
      request: { payload: { featureFlagKey: "evaluation" } },
    })
    expectResponse(response, 201)
    const flags = await repositories.featureFlagRepository.find({
      where: { projectId: project.id, featureFlagKey: "evaluation" },
    })
    expect(flags.length).toBe(1)
  })

  it("removes a feature flag from a project", async () => {
    const { project } = await createAuthorizedContext()
    await repositories.featureFlagRepository.save(
      repositories.featureFlagRepository.create({
        projectId: project.id,
        featureFlagKey: "evaluation",
        enabled: true,
      }),
    )
    const response = await request({
      route: BackofficeRoutes.removeFeatureFlag,
      pathParams: { projectId: project.id, featureFlagKey: "evaluation" },
      token: "token",
    })
    expectResponse(response, 200)
    const flag = await repositories.featureFlagRepository.findOne({
      where: { projectId: project.id, featureFlagKey: "evaluation" },
    })
    expect(flag).toBeNull()
  })

  it("rejects org owners who lack a project membership (no backoffice.project.update)", async () => {
    const email = mockOidcEmailForSub(authSubject)
    const { organization, user } = await createOrganizationWithProject(repositories, {
      user: { authSubject, email },
    })
    // staff can enter the backoffice; org role grants project *read* via inheritance
    // but not project *update*
    await assignPlatformStaffToUser({ repositories, user })

    const otherProject = await repositories.projectRepository.save(
      projectFactory.transient({ organization }).build(),
    )

    const response = await request({
      route: BackofficeRoutes.addFeatureFlag,
      pathParams: { projectId: otherProject.id },
      token: "token",
      request: { payload: { featureFlagKey: "evaluation" } },
    })
    expectResponse(response, 403)
  })

  it("rejects unknown feature flag keys", async () => {
    const { project } = await createAuthorizedContext()
    const response = await request({
      route: BackofficeRoutes.addFeatureFlag,
      pathParams: { projectId: project.id },
      token: "token",
      request: {
        payload: {
          featureFlagKey: "not-a-real-flag" as never,
        },
      },
    })
    expectResponse(response, 400)
  })

  it("returns 404 when the project does not exist", async () => {
    await createAuthorizedContext()
    const response = await request({
      route: BackofficeRoutes.addFeatureFlag,
      pathParams: { projectId: randomUUID() },
      token: "token",
      request: { payload: { featureFlagKey: "evaluation" } },
    })
    expectResponse(response, 404)
  })

  it("returns enabled flag in organization detail", async () => {
    const { organization, project } = await createAuthorizedContext()
    await repositories.featureFlagRepository.save(
      repositories.featureFlagRepository.create({
        projectId: project.id,
        featureFlagKey: "evaluation",
        enabled: true,
      }),
    )
    const response = await request({
      route: BackofficeRoutes.getOrganization,
      pathParams: { organizationId: organization.id },
      token: "token",
    })
    expectResponse(response, 200)
    const returnedProject = response.body.data.projects.find(
      (proj: { id: string }) => proj.id === project.id,
    )
    expect(returnedProject?.featureFlags).toContain("evaluation")
  })
})
