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

describe("Evaluation review campaigns - deleteOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
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

  const createCampaign = async (status: "draft" | "active") => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      (status === "active" ? reviewCampaignFactory.active() : reviewCampaignFactory)
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    return campaign
  }

  const subject = () =>
    request({
      route: EvalReviewCampaignsRoutes.deleteOne,
      pathParams: { organizationId, projectId, reviewCampaignId },
      token: "token",
    })

  it("soft-deletes a draft campaign", async () => {
    const campaign = await createCampaign("draft")

    const response = await subject()

    expectSchemaResponse(EvalReviewCampaignsRoutes.deleteOne, response)
    expect(response.body.data).toStrictEqual({ success: true })
    expect(await repositories.reviewCampaignRepository.findOneBy({ id: campaign.id })).toBeNull()
  })

  it("refuses to delete an active campaign", async () => {
    const campaign = await createCampaign("active")

    expectResponse(await subject(), 409)
    expect(
      await repositories.reviewCampaignRepository.findOneBy({ id: campaign.id }),
    ).not.toBeNull()
  })
})
