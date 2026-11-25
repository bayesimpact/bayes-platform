import { randomUUID } from "node:crypto"
import { EvalReviewCampaignsRoutes } from "@caseai-connect/eval-contracts"
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
  addUserToReviewCampaign,
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation review campaigns - getAllMine", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /**
   * A project with an agent, its campaigns in every status, and a caller who tests the active one
   * and reviews the active, the closed and the draft ones.
   */
  const createContext = async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { agent: { type: "conversation" } },
    )
    const saveCampaign = (factory: typeof reviewCampaignFactory, name: string) =>
      repositories.reviewCampaignRepository.save(
        factory
          .transient({ organization, project, agent, agentSettings })
          .build({ name, description: `${name} campaign` }),
      )
    const activeCampaign = await saveCampaign(reviewCampaignFactory.active(), "Active")
    const closedCampaign = await saveCampaign(reviewCampaignFactory.closed(), "Closed")
    const draftCampaign = await saveCampaign(reviewCampaignFactory, "Draft")
    const { user } = await addUserToReviewCampaign({
      repositories,
      organization,
      project,
      campaign: activeCampaign,
      roleKeys: ["review_campaign_tester", "review_campaign_reviewer"],
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    for (const campaign of [closedCampaign, draftCampaign]) {
      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .withRoles("review_campaign_reviewer")
          .transient({ organization, project, campaign, user })
          .build(),
      })
    }
    return {
      organization,
      project,
      user,
      saveCampaign,
      agent,
      activeCampaign,
      closedCampaign,
      draftCampaign,
    }
  }

  const subject = (query: Record<string, string>) =>
    request({ route: EvalReviewCampaignsRoutes.getAllMine, query, token: "token" })

  it("lists my campaigns as a tester and as a reviewer", async () => {
    const { agent, activeCampaign, closedCampaign } = await createContext()

    const testerResponse = await subject({ role: "tester" })
    expectSchemaResponse(EvalReviewCampaignsRoutes.getAllMine, testerResponse)
    expect(testerResponse.body.data.reviewCampaigns).toStrictEqual([
      {
        id: activeCampaign.id,
        name: "Active",
        description: "Active campaign",
        status: "active",
        organizationId: activeCampaign.organizationId,
        projectId: activeCampaign.projectId,
        agentId: agent.id,
        createdAt: activeCampaign.createdAt.getTime(),
        agent: { name: agent.name, type: "conversation" },
      },
    ])

    // A reviewer keeps the closed campaigns, and never sees a draft.
    const reviewerResponse = await subject({ role: "reviewer" })
    expectSchemaResponse(EvalReviewCampaignsRoutes.getAllMine, reviewerResponse)
    expect(
      reviewerResponse.body.data.reviewCampaigns.map((campaign) => campaign.id).sort(),
    ).toEqual([activeCampaign.id, closedCampaign.id].sort())
  })

  it("leaves a campaign I only test out of the campaigns I review", async () => {
    const { organization, project, user, saveCampaign, activeCampaign, closedCampaign } =
      await createContext()
    const testedOnlyCampaign = await saveCampaign(reviewCampaignFactory.active(), "Tested only")
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .withRoles("review_campaign_tester")
        .transient({ organization, project, campaign: testedOnlyCampaign, user })
        .build(),
    })

    const reviewerResponse = await subject({ role: "reviewer" })
    expectSchemaResponse(EvalReviewCampaignsRoutes.getAllMine, reviewerResponse)
    expect(
      reviewerResponse.body.data.reviewCampaigns.map((campaign) => campaign.id).sort(),
    ).toEqual([activeCampaign.id, closedCampaign.id].sort())

    const testerResponse = await subject({ role: "tester" })
    expect(testerResponse.body.data.reviewCampaigns.map((campaign) => campaign.id).sort()).toEqual(
      [activeCampaign.id, testedOnlyCampaign.id].sort(),
    )
  })

  it("answers 400 for an unknown role", async () => {
    await createContext()
    expectResponse(await subject({ role: "admin" }), 400)
  })

  it("answers 400 without a role, which the old handler took as tester", async () => {
    await createContext()
    expectResponse(await subject({}), 400)
  })
})
