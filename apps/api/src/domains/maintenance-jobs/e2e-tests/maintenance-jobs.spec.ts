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
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
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

describe("Maintenance jobs", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  const queue = new FakeMaintenanceJobsQueue()

  let authSubject = `oidc|${randomUUID()}`

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
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createSuperadmin = async (): Promise<User> => {
    const user = userFactory.build({ authSubject, email: mockOidcEmailForSub(authSubject) })
    await repositories.userRepository.save(user)
    await assignPlatformSuperadminToUser({ repositories, user })
    return user
  }

  const list = () => request({ route: BackofficeRoutes.listMaintenanceJobs, token: "token" })
  const run = (jobKey = sampleMaintenanceJob.key) =>
    request({
      route: BackofficeRoutes.runMaintenanceJob,
      pathParams: { jobKey },
      token: "token",
    })

  it("lists the jobs with what is left to do and no run yet", async () => {
    await createSuperadmin()

    const response = await list()

    expectResponse(response, 200)
    expect(response.body.data.jobs).toEqual([
      {
        key: sampleMaintenanceJob.key,
        title: sampleMaintenanceJob.title,
        description: sampleMaintenanceJob.description,
        remainingCount: 2,
        remainingSummary: "2 records",
        lastRun: null,
      },
    ])
  })

  it("starts a run for the caller and records who started it", async () => {
    const user = await createSuperadmin()

    const response = await run()

    expectResponse(response, 201)
    expect(response.body.data.lastRun).toMatchObject({
      state: "waiting",
      finishedAt: null,
      progress: null,
      summary: null,
      error: null,
    })
    expect(queue.runs.get(sampleMaintenanceJob.key)?.data).toEqual({ requestedByUserId: user.id })
    const activities: { action: string; userId: string }[] = await setup.dataSource.query(
      `SELECT action, user_id AS "userId" FROM activity`,
    )
    expect(activities).toEqual([{ action: "backoffice.maintenance_job.run", userId: user.id }])
  })

  it("refuses a second run while one is waiting or active", async () => {
    await createSuperadmin()
    await run()

    expectResponse(await run(), 409)
  })

  it("shows how the last run ended and starts a new one after it", async () => {
    await createSuperadmin()
    await run()
    queue.finish(sampleMaintenanceJob.key, { error: "Connection lost." })

    const listed = await list()
    expect(listed.body.data.jobs[0]?.lastRun).toMatchObject({
      state: "failed",
      progress: { done: 2, total: 2 },
      error: "Connection lost.",
    })

    const restarted = await run()
    expectResponse(restarted, 201)
    expect(restarted.body.data.lastRun?.state).toBe("waiting")
  })

  it("shows the summary of a completed run", async () => {
    await createSuperadmin()
    await run()
    queue.finish(sampleMaintenanceJob.key, { summary: "2 records moved." })

    const listed = await list()

    expect(listed.body.data.jobs[0]?.lastRun).toMatchObject({
      state: "completed",
      summary: "2 records moved.",
      error: null,
    })
  })

  it("answers 404 for an unknown job", async () => {
    await createSuperadmin()

    expectResponse(await run("unknown-job"), 404)
  })
})
