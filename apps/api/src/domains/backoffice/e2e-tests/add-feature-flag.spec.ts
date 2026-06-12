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
import { mockAuth0EmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - feature flag lifecycle", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let auth0Id = `auth0|${randomUUID()}`

  const originalAuthorizedEmails = process.env.BACKOFFICE_AUTHORIZED_EMAILS
  const originalAuthorizedDomain = process.env.BACKOFFICE_AUTHORIZED_DOMAIN

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [BackofficeModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    auth0Id = `auth0|${randomUUID()}`
    delete process.env.BACKOFFICE_AUTHORIZED_DOMAIN
    delete process.env.BACKOFFICE_AUTHORIZED_EMAILS
  })

  afterEach(() => {
    if (originalAuthorizedEmails === undefined) {
      delete process.env.BACKOFFICE_AUTHORIZED_EMAILS
    } else {
      process.env.BACKOFFICE_AUTHORIZED_EMAILS = originalAuthorizedEmails
    }
    if (originalAuthorizedDomain === undefined) {
      delete process.env.BACKOFFICE_AUTHORIZED_DOMAIN
    } else {
      process.env.BACKOFFICE_AUTHORIZED_DOMAIN = originalAuthorizedDomain
    }
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createAuthorizedContext = async () => {
    const email = mockAuth0EmailForSub(auth0Id)
    const context = await createOrganizationWithProject(repositories, {
      user: { auth0Id, email },
    })
    process.env.BACKOFFICE_AUTHORIZED_DOMAIN = "@example.com"
    process.env.BACKOFFICE_AUTHORIZED_EMAILS = email
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

  it("lists organizations with nested projects and enabled flags", async () => {
    const { project } = await createAuthorizedContext()
    await repositories.featureFlagRepository.save(
      repositories.featureFlagRepository.create({
        projectId: project.id,
        featureFlagKey: "evaluation",
        enabled: true,
      }),
    )
    const response = await request({
      route: BackofficeRoutes.listOrganizations,
      token: "token",
    })
    expectResponse(response, 200)
    const organizations = response.body.data.organizations
    expect(organizations.length).toBeGreaterThanOrEqual(1)
    const organization = organizations.find((org) =>
      org.projects.some((proj) => proj.id === project.id),
    )
    expect(organization).toBeDefined()
    const returnedProject = organization?.projects.find((proj) => proj.id === project.id)
    expect(returnedProject?.featureFlags).toContain("evaluation")
  })
})
