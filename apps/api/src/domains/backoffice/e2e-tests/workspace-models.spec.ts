import { randomUUID } from "node:crypto"
import {
  AgentModel,
  type BackofficeProjectModelDto,
  BackofficeRoutes,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformStaffToUser,
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

// TEST-NET-3: a public address that needs no DNS lookup.
const PUBLIC_SERVER_URL = "https://203.0.113.10/v1"

describe("Backoffice - workspace models", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`
  let accessToken: string | undefined = "token"
  let projectId: string

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [BackofficeModule, RbacModule, ActivitiesModule],
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
    accessToken = "token"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async (
    assignGlobalRole: typeof assignPlatformSuperadminToUser = assignPlatformSuperadminToUser,
  ): Promise<User> => {
    const { project } = await createOrganizationWithProject(repositories)
    projectId = project.id
    const user = userFactory.build({ authSubject, email: mockOidcEmailForSub(authSubject) })
    await repositories.userRepository.save(user)
    await assignGlobalRole({ repositories, user })
    return user
  }

  const listModels = () =>
    request({
      route: BackofficeRoutes.listProjectModels,
      pathParams: { projectId },
      token: accessToken,
    })

  const setModel = (model: string, enabled: boolean) =>
    request({
      route: BackofficeRoutes.setProjectModel,
      pathParams: { projectId },
      token: accessToken,
      request: { payload: { model, enabled } },
    })

  const createCustomModel = (
    payload: Partial<typeof BackofficeRoutes.createCustomModel.request.payload> = {},
  ) =>
    request({
      route: BackofficeRoutes.createCustomModel,
      pathParams: { projectId },
      token: accessToken,
      request: {
        payload: {
          name: "Gemma on the new server",
          baseModel: AgentModel.Gemma4_26B,
          baseUrl: PUBLIC_SERVER_URL,
          apiKey: "secret-key",
          servedModelName: null,
          ...payload,
        },
      },
    })

  const entryOf = (models: BackofficeProjectModelDto[], model: AgentModel) =>
    models.find((entry) => entry.model === model)

  describe("auth", () => {
    it("refuses a request without token", async () => {
      await createContext()
      accessToken = undefined

      expectResponse(await listModels(), 401)
    })

    it("refuses platform staff, who do not hold the permission", async () => {
      await createContext(assignPlatformStaffToUser)

      expectResponse(await listModels(), 403)
      expectResponse(await createCustomModel(), 403)
    })
  })

  it("lists the models of the code with their default", async () => {
    await createContext()

    const response = await listModels()

    expectResponse(response, 200)
    expect(entryOf(response.body.data.models, AgentModel.Gemini35Flash)).toMatchObject({
      enabled: true,
      customized: false,
      deprecation: null,
      servedOutsideEu: false,
    })
    expect(entryOf(response.body.data.models, AgentModel.Gemini25Flash)?.deprecation).toEqual({
      deprecatedOn: expect.any(String),
      recommendedReplacement: expect.any(String),
    })
    expect(entryOf(response.body.data.models, AgentModel.Gemma4_26B)).toMatchObject({
      selfHosted: true,
      enabled: false,
      customized: false,
    })
  })

  it("turns a model on for the workspace, then back to its default", async () => {
    await createContext()

    const turnedOn = await setModel(AgentModel.Gemma4_26B, true)

    expectResponse(turnedOn, 200)
    expect(entryOf(turnedOn.body.data.models, AgentModel.Gemma4_26B)).toMatchObject({
      enabled: true,
      customized: true,
    })

    const reset = await request({
      route: BackofficeRoutes.resetProjectModel,
      pathParams: { projectId },
      token: accessToken,
      request: { payload: { model: AgentModel.Gemma4_26B } },
    })

    expectResponse(reset, 201)
    expect(entryOf(reset.body.data.models, AgentModel.Gemma4_26B)).toMatchObject({
      enabled: false,
      customized: false,
    })
  })

  it("adds a model with a key it never sends back, and records who did", async () => {
    const user = await createContext()

    const response = await createCustomModel()

    expectResponse(response, 201)
    expect(response.body.data.customModels).toEqual([
      expect.objectContaining({
        name: "Gemma on the new server",
        baseModel: AgentModel.Gemma4_26B,
        baseUrl: PUBLIC_SERVER_URL,
        hasApiKey: true,
        agentCount: 0,
      }),
    ])
    expect(response.body.data.types.map((type) => type.model)).toContain(AgentModel.Qwen38_27B)
    expect(JSON.stringify(response.body)).not.toContain("secret-key")
    const activities: { action: string; userId: string }[] = await setup.dataSource.query(
      `SELECT action, user_id AS "userId" FROM activity`,
    )
    expect(activities).toEqual([{ action: "backoffice.custom_model.create", userId: user.id }])
  })

  it.each([
    ["http://203.0.113.10/v1", "https"],
    ["https://10.0.0.5/v1", "public address"],
    ["https://169.254.169.254/", "public address"],
    ["https://user:pass@203.0.113.10/v1", "credentials"],
  ])("refuses the unsafe server %s", async (baseUrl, message) => {
    await createContext()

    const response = await createCustomModel({ baseUrl })

    expectResponse(response, 400)
    expect(JSON.stringify(response.body)).toContain(message)
  })

  it("refuses a type that is not self-hosted", async () => {
    await createContext()

    expectResponse(await createCustomModel({ baseModel: AgentModel.Gemini35Flash }), 400)
  })

  it("updates then deletes an added model", async () => {
    await createContext()
    const created = await createCustomModel()
    const customModelId = created.body.data.customModels[0]?.id ?? ""

    const updated = await request({
      route: BackofficeRoutes.updateCustomModel,
      pathParams: { projectId, customModelId },
      token: accessToken,
      request: {
        payload: { name: "Renamed", baseUrl: PUBLIC_SERVER_URL, servedModelName: "gemma-new" },
      },
    })

    expectResponse(updated, 200)
    expect(updated.body.data.customModels[0]).toMatchObject({
      name: "Renamed",
      servedModelName: "gemma-new",
      hasApiKey: true,
    })

    const deleted = await request({
      route: BackofficeRoutes.deleteCustomModel,
      pathParams: { projectId, customModelId },
      token: accessToken,
    })

    expectResponse(deleted, 200)
    expect(deleted.body.data.customModels).toEqual([])
  })

  it("answers 404 for a workspace that does not exist", async () => {
    await createContext()
    projectId = randomUUID()

    expectResponse(await listModels(), 404)
    expectResponse(await createCustomModel(), 404)
  })
})
