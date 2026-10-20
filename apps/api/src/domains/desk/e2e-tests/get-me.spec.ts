import { randomUUID } from "node:crypto"
import { DeskAccountRoutes, meOutputSchema } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import {
  organizationMembershipFactory,
  saveOrgMembership,
} from "@/domains/organizations/memberships/organization-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithOwner,
} from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { addUserToReviewCampaign } from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DeskModule } from "../desk.module"

describe("Desk - getMe", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

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
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const subject = async () => {
    const response = await request({ route: DeskAccountRoutes.getMe, token: "token" })
    expectResponse(response, 200)
    // The interceptor already parsed it: this proves the body is what the Desk will read.
    return meOutputSchema.parse(response.body.data)
  }

  it("returns the caller and their projects of every organization, sorted by organization then project", async () => {
    const { user, organization: firstOrganization } = await createOrganizationWithOwner(
      repositories,
      {
        user: { authSubject, email: mockOidcEmailForSub(authSubject), name: "Ada Lovelace" },
        organization: { name: "Blue organization" },
      },
    )
    const reports = await repositories.projectRepository.save(
      projectFactory.transient({ organization: firstOrganization }).build({ name: "Reports" }),
    )
    const pricing = await repositories.projectRepository.save(
      projectFactory.transient({ organization: firstOrganization }).build({ name: "Pricing" }),
    )
    await addUserToProject({ repositories, project: reports, user, membership: { role: "owner" } })
    await addUserToProject({ repositories, project: pricing, user, membership: { role: "member" } })

    const { organization: secondOrganization, project: support } =
      await createOrganizationWithAgent(repositories, {
        organization: { name: "Amber organization" },
        project: { name: "Support" },
      })
    await saveOrgMembership({
      repositories,
      membership: organizationMembershipFactory
        .member()
        .transient({ user, organization: secondOrganization })
        .build(),
    })
    await addUserToProject({ repositories, project: support, user, membership: { role: "admin" } })

    const me = await subject()

    expect(me.user).toEqual({ id: user.id, name: "Ada Lovelace", email: user.email })
    expect(me.projects).toEqual([
      {
        id: support.id,
        name: "Support",
        organization: { id: secondOrganization.id, name: "Amber organization" },
      },
      {
        id: pricing.id,
        name: "Pricing",
        organization: { id: firstOrganization.id, name: "Blue organization" },
      },
      {
        id: reports.id,
        name: "Reports",
        organization: { id: firstOrganization.id, name: "Blue organization" },
      },
    ])
  })

  it("leaves out a project where the caller holds only an organization role or a campaign role", async () => {
    const { organization, project, agent, agentSettings } =
      await createOrganizationWithAgent(repositories)
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    const { user } = await addUserToReviewCampaign({
      repositories,
      organization,
      project,
      campaign,
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    // An organization the caller owns, with a project they hold no role on.
    const { organization: ownedOrganization } = await createOrganizationWithOwner(repositories)
    await saveOrgMembership({
      repositories,
      membership: organizationMembershipFactory
        .owner()
        .transient({ user, organization: ownedOrganization })
        .build(),
    })
    await repositories.projectRepository.save(
      projectFactory.transient({ organization: ownedOrganization }).build(),
    )

    const me = await subject()

    expect(me.projects).toEqual([])
  })

  it("returns a null name for a person whose identity provider gave none", async () => {
    await createOrganizationWithOwner(repositories, {
      user: { authSubject, email: mockOidcEmailForSub(authSubject), name: null },
    })

    const me = await subject()

    expect(me.user.name).toBeNull()
  })
})
