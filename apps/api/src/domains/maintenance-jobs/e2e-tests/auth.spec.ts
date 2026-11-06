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
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { userFactory } from "@/domains/users/user.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformStaffToUser,
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { MaintenanceJobsModule } from "../maintenance-jobs.module"
import {
  FakeMaintenanceJobsQueue,
  sampleMaintenanceJob,
  withFakeMaintenanceJobs,
} from "./maintenance-jobs.test-helpers"

describe("Maintenance jobs - auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  const queue = new FakeMaintenanceJobsQueue()

  let authSubject = `oidc|${randomUUID()}`
  let accessToken: string | undefined = "token"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [MaintenanceJobsModule, RbacModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(withFakeMaintenanceJobs(moduleBuilder, queue), () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    queue.runs.clear()
    authSubject = `oidc|${randomUUID()}`
    accessToken = "token"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createCaller = async (assignRole?: typeof assignPlatformSuperadminToUser) => {
    const user = userFactory.build({ authSubject, email: mockOidcEmailForSub(authSubject) })
    await repositories.userRepository.save(user)
    if (assignRole) await assignRole({ repositories, user })
  }

  const list = () => request({ route: BackofficeRoutes.listMaintenanceJobs, token: accessToken })
  const run = () =>
    request({
      route: BackofficeRoutes.runMaintenanceJob,
      pathParams: { jobKey: sampleMaintenanceJob.key },
      token: accessToken,
    })

  describe.each([
    ["listMaintenanceJobs", list, 200],
    ["runMaintenanceJob", run, 201],
  ] as const)("%s", (_, subject, successStatus) => {
    it("rejects a request without a token", async () => {
      await createCaller(assignPlatformSuperadminToUser)
      accessToken = undefined
      expectResponse(await subject(), 401)
    })

    it("rejects a user with no platform role", async () => {
      await createCaller()
      expectResponse(await subject(), 403)
    })

    it("rejects platform staff", async () => {
      await createCaller(assignPlatformStaffToUser)
      expectResponse(await subject(), 403)
    })

    it("allows a platform superadmin", async () => {
      await createCaller(assignPlatformSuperadminToUser)
      expectResponse(await subject(), successStatus)
    })
  })
})
