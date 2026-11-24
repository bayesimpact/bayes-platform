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
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation review campaigns - revokeMembership", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
  let membershipId: string = randomUUID()
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

  /** A campaign of the given status where the caller holds a tester's membership. */
  const createContext = async (status: "active" | "closed" = "active") => {
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      (status === "closed" ? reviewCampaignFactory.closed() : reviewCampaignFactory.active())
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    const membership = await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .withRoles("review_campaign_tester")
        .transient({ organization, project, campaign, user })
        .build(),
    })
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    membershipId = membership.id
    return { membership }
  }

  const subject = () =>
    request({
      route: EvalReviewCampaignsRoutes.revokeMembership,
      pathParams: { organizationId, projectId, reviewCampaignId, membershipId },
      token: "token",
    })

  it("removes an existing membership", async () => {
    const { membership } = await createContext()

    const response = await subject()

    expectSchemaResponse(EvalReviewCampaignsRoutes.revokeMembership, response)
    expect(response.body.data).toStrictEqual({ success: true })
    expect(await repositories.roleGrantRepository.findOneBy({ id: membership.id })).toBeNull()
  })

  it("answers 404 when the membership is not in this campaign", async () => {
    await createContext()
    membershipId = randomUUID()
    expectResponse(await subject(), 404)
  })

  it("answers 400 for a membership id that is not a UUID", async () => {
    await createContext()
    membershipId = "not-a-uuid"
    expectResponse(await subject(), 400)
  })

  it("refuses to revoke a membership of a closed campaign", async () => {
    const { membership } = await createContext("closed")
    expectResponse(await subject(), 403, "Cannot revoke memberships from a closed campaign")
    expect(await repositories.roleGrantRepository.findOneBy({ id: membership.id })).not.toBeNull()
  })
})
