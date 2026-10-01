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
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import {
  AGENT_ROLE_PERMISSIONS,
  AGENT_ROLES,
  ORGANIZATION_ROLE_PERMISSIONS,
  ORGANIZATION_ROLES,
  PLATFORM_SUPERADMIN_ROLE,
  PROJECT_ROLE_PERMISSIONS,
  PROJECT_ROLES,
} from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - get user", () => {
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
    const context = await createOrganizationWithAgent(repositories, {
      user: { authSubject, email },
    })
    await assignPlatformSuperadminToUser({ repositories, user: context.user })
    return context
  }

  it("returns the user detail with organization, agent, and review campaign memberships", async () => {
    const { user, organization, project, agent, agentSettings } = await createAuthorizedContext()
    const reviewCampaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.transient({ organization, project, agent, agentSettings }).build({
        name: "Review campaign",
      }),
    )
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .reviewer()
        .transient({ organization, project, campaign: reviewCampaign, user })
        .build(),
    })

    const response = await request({
      route: BackofficeRoutes.getUser,
      pathParams: { userId: user.id },
      token: "token",
    })
    expectResponse(response, 200)
    const returned = response.body.data
    expect(returned.id).toBe(user.id)
    expect(returned.email).toBe(user.email)
    expect(returned.globalRoles).toEqual([
      expect.objectContaining({
        key: PLATFORM_SUPERADMIN_ROLE,
        permissions: expect.arrayContaining([
          ...ORGANIZATION_ROLE_PERMISSIONS[PLATFORM_SUPERADMIN_ROLE],
        ]),
      }),
    ])
    expect(returned.organizationMemberships).toEqual([
      {
        organizationId: organization.id,
        organizationName: organization.name,
        role: "owner",
        roleKey: ORGANIZATION_ROLES.owner,
        permissions: expect.arrayContaining([...ORGANIZATION_ROLE_PERMISSIONS.org_owner]),
      },
    ])
    expect(returned.projectMemberships).toEqual([
      {
        projectId: project.id,
        projectName: project.name,
        role: "owner",
        roleKey: PROJECT_ROLES.owner,
        permissions: expect.arrayContaining([...PROJECT_ROLE_PERMISSIONS.project_owner]),
      },
    ])
    expect(returned.agentMemberships).toEqual([
      {
        agentId: agent.id,
        agentName: agent.name,
        role: "owner",
        roleKey: AGENT_ROLES.owner,
        permissions: expect.arrayContaining([...AGENT_ROLE_PERMISSIONS.agent_owner]),
      },
    ])
    expect(returned.reviewCampaignMemberships).toEqual([
      {
        campaignId: reviewCampaign.id,
        campaignName: reviewCampaign.name,
        role: "reviewer",
      },
    ])
    expect(returned.organizationMemberships[0]?.permissions).toHaveLength(
      ORGANIZATION_ROLE_PERMISSIONS.org_owner.length,
    )
    expect(returned.projectMemberships[0]?.permissions).toHaveLength(
      PROJECT_ROLE_PERMISSIONS.project_owner.length,
    )
    expect(returned.agentMemberships[0]?.permissions).toHaveLength(
      AGENT_ROLE_PERMISSIONS.agent_owner.length,
    )
  })

  it("returns empty membership lists for a user with no memberships", async () => {
    await createAuthorizedContext()
    const isolatedUser = await repositories.userRepository.save(
      repositories.userRepository.create({
        authSubject: `oidc|${randomUUID()}`,
        email: `isolated-${randomUUID()}@example.com`,
        name: null,
        pictureUrl: null,
      }),
    )
    const response = await request({
      route: BackofficeRoutes.getUser,
      pathParams: { userId: isolatedUser.id },
      token: "token",
    })
    expectResponse(response, 200)
    expect(response.body.data.globalRoles).toEqual([])
    expect(response.body.data.organizationMemberships).toEqual([])
    expect(response.body.data.projectMemberships).toEqual([])
    expect(response.body.data.agentMemberships).toEqual([])
    expect(response.body.data.reviewCampaignMemberships).toEqual([])
  })

  it("returns 404 for an unknown user id", async () => {
    await createAuthorizedContext()
    const response = await request({
      route: BackofficeRoutes.getUser,
      pathParams: { userId: randomUUID() },
      token: "token",
    })
    expectResponse(response, 404)
  })
})
