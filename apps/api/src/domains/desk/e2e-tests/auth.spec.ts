import { randomUUID } from "node:crypto"
import { DeskAccountRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { addUserToReviewCampaign } from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DeskModule } from "../desk.module"

// The access matrix of the Desk routes that name a project or an agent is in desk-access.spec.ts.
describe("Desk - auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
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
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const newCaller = () => {
    authSubject = `oidc|${randomUUID()}`
    return { authSubject, email: mockOidcEmailForSub(authSubject) }
  }

  describe("GET desk/me", () => {
    const subject = () => request({ route: DeskAccountRoutes.getMe, token: accessToken })

    it("answers 401 without a token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("serves a signed-in person who holds no membership at all", async () => {
      expectResponse(await subject(), 200)
    })

    it.each(["owner", "admin", "member"] as const)("serves a project %s", async (role) => {
      await createOrganizationWithProject(repositories, {
        user: newCaller(),
        projectMembership: { role },
      })
      expectResponse(await subject(), 200)
    })

    it("serves an organization admin with no project role", async () => {
      const { organization } = await createOrganizationWithProject(repositories)
      await addUserToOrganization({
        repositories,
        organization,
        user: newCaller(),
        membership: { role: "admin" },
      })
      expectResponse(await subject(), 200)
    })

    it.each(["tester", "reviewer"] as const)("serves a review campaign %s", async (role) => {
      const { organization, project, agent, agentSettings } =
        await createOrganizationWithAgent(repositories)
      const campaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory
          .active()
          .transient({ organization, project, agent, agentSettings })
          .build(),
      )
      await addUserToReviewCampaign({
        repositories,
        organization,
        project,
        campaign,
        role,
        user: newCaller(),
      })
      expectResponse(await subject(), 200)
    })
  })
})
