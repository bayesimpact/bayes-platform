import { randomUUID } from "node:crypto"
import { AnalyticsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  RandomUuid,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { mockForeignAuth0Id, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ProjectsAnalyticsModule } from "../projects-analytics.module"

describe("Projects Analytics - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string | null = RandomUuid.Organization
  let projectId: string | null = RandomUuid.Project
  let accessToken: string | null = "token"
  let auth0Id = `auth0|${randomUUID()}`

  const dateRange = {
    startAt: new Date("2026-01-01T00:00:00.000Z").getTime(),
    endAt: new Date("2026-01-03T23:59:59.999Z").getTime(),
  }

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsAnalyticsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = RandomUuid.Organization
    projectId = RandomUuid.Project
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: "owner" | "admin" | "member" = "owner") => {
    const { organization, project, user } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
      projectMembership: { role },
    })
    organizationId = organization.id
    projectId = project.id
    accessToken = "token"
    return { organization, project, user }
  }

  const analyticsDateRangeQuery = {
    startAt: String(dateRange.startAt),
    endAt: String(dateRange.endAt),
  }

  const subjectConversations = async () =>
    request({
      route: AnalyticsRoutes.getConversationsPerDay,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken ?? undefined,
      query: analyticsDateRangeQuery,
    })

  const subjectAvg = async () =>
    request({
      route: AnalyticsRoutes.getAvgUserQuestionsPerSessionPerDay,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken ?? undefined,
      query: analyticsDateRangeQuery,
    })

  it("requires an authentication token", async () => {
    accessToken = null
    expectResponse(await subjectConversations(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    expectResponse(await subjectAvg(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("requires a valid organization ID", async () => {
    organizationId = null
    expectResponse(await subjectConversations(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    expectResponse(await subjectAvg(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
  })

  it("requires the user to be a member of the organization", async () => {
    await createContextForRole("owner")
    auth0Id = mockForeignAuth0Id()
    expectResponse(await subjectConversations(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    expectResponse(await subjectAvg(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
  })

  it("allows admins to list analytics for a project", async () => {
    await createContextForRole("admin")
    expectResponse(await subjectConversations(), 200)
    expectResponse(await subjectAvg(), 200)
  })

  it("allows owners to list analytics for a project", async () => {
    await createContextForRole("owner")
    expectResponse(await subjectConversations(), 200)
    expectResponse(await subjectAvg(), 200)
  })

  it("doesn't allow members to list analytics for a project", async () => {
    await createContextForRole("member")
    expectResponse(await subjectConversations(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await subjectAvg(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("requires an existing project ID", async () => {
    await createContextForRole("owner")
    projectId = randomUUID()
    expectResponse(await subjectConversations(), 404)
    expectResponse(await subjectAvg(), 404)
  })
})
