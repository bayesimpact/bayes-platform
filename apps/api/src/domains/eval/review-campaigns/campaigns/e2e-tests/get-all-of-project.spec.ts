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
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation review campaigns - getAllOfProject", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
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

  const subject = () =>
    request({
      route: EvalReviewCampaignsRoutes.getAllOfProject,
      pathParams: { organizationId, projectId },
      token: "token",
    })

  it("lists the campaigns of the project with how many people take part in each", async () => {
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const [withMembers, empty] = await repositories.reviewCampaignRepository.save([
      reviewCampaignFactory
        .transient({ organization, project, agent, agentSettings })
        .build({ name: "with-members" }),
      reviewCampaignFactory
        .transient({ organization, project, agent, agentSettings })
        .build({ name: "empty" }),
    ])
    if (!withMembers || !empty) throw new Error("factory returned empty")
    for (const roleKey of ["review_campaign_tester", "review_campaign_reviewer"] as const) {
      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .withRoles(roleKey)
          .transient({ organization, project, campaign: withMembers, user })
          .build(),
      })
    }
    organizationId = organization.id
    projectId = project.id

    const response = await subject()

    expectSchemaResponse(EvalReviewCampaignsRoutes.getAllOfProject, response)
    const memberCountByName = new Map(
      response.body.data.reviewCampaigns.map((campaign) => [campaign.name, campaign.memberCount]),
    )
    expect(memberCountByName).toEqual(
      new Map([
        ["with-members", 2],
        ["empty", 0],
      ]),
    )
    expect(
      response.body.data.reviewCampaigns.find((campaign) => campaign.name === "empty"),
    ).toEqual(
      expect.objectContaining({
        id: empty.id,
        organizationId,
        projectId,
        agentId: agent.id,
        agentSettingsId: agentSettings.id,
        status: "draft",
      }),
    )
  })

  it("does not list the campaigns of another project", async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .transient({ organization, project, agent, agentSettings })
        .build({ name: "mine" }),
    )
    const other = await createOrganizationWithAgent(repositories)
    await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .transient({
          organization: other.organization,
          project: other.project,
          agent: other.agent,
          agentSettings: other.agentSettings,
        })
        .build({ name: "other" }),
    )
    organizationId = organization.id
    projectId = project.id

    const response = await subject()

    expectSchemaResponse(EvalReviewCampaignsRoutes.getAllOfProject, response)
    expect(response.body.data.reviewCampaigns.map((campaign) => campaign.name)).toEqual(["mine"])
  })
})
