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
import { addUserToReviewCampaign } from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { reviewCampaignStatusErrorMessage } from "@/domains/review-campaigns/review-campaign-status"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation review campaigns - getContext", () => {
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

  /** A campaign of the given status, and a caller who tests it. */
  const createContextAsTester = async (
    status: "draft" | "active" | "closed",
    agentSettingsFields: { greetingMessage?: string | null } = {},
  ) => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { agent: { type: "conversation" }, agentSettings: agentSettingsFields },
    )
    const factory =
      status === "active"
        ? reviewCampaignFactory.active()
        : status === "closed"
          ? reviewCampaignFactory.closed()
          : reviewCampaignFactory
    const campaign = await repositories.reviewCampaignRepository.save(
      factory.transient({ organization, project, agent, agentSettings }).build({
        description: "How the Helpful Assistant answers",
        testerPerSessionQuestions: [
          { id: "tp-1", prompt: "Was the agent helpful?", type: "rating", required: true },
        ],
        testerEndOfPhaseQuestions: [
          {
            id: "te-1",
            prompt: "Pick a tag",
            type: "single-choice",
            required: false,
            options: ["Product", "Pricing"],
          },
        ],
      }),
    )
    await addUserToReviewCampaign({
      repositories,
      organization,
      project,
      campaign,
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    return { agent, campaign }
  }

  const subject = () =>
    request({
      route: EvalReviewCampaignsRoutes.getContext,
      pathParams: { organizationId, projectId, reviewCampaignId },
      token: "token",
    })

  it("returns the campaign, a snapshot of its agent and its tester questions", async () => {
    const { agent, campaign } = await createContextAsTester("active", {
      greetingMessage: "Hello, how can I help?",
    })

    const response = await subject()

    expectSchemaResponse(EvalReviewCampaignsRoutes.getContext, response)
    expect(response.body.data).toStrictEqual({
      id: campaign.id,
      name: campaign.name,
      description: "How the Helpful Assistant answers",
      status: "active",
      agent: {
        id: agent.id,
        name: agent.name,
        type: "conversation",
        greetingMessage: "Hello, how can I help?",
      },
      testerPerSessionQuestions: campaign.testerPerSessionQuestions,
      testerEndOfPhaseQuestions: campaign.testerEndOfPhaseQuestions,
    })
  })

  it("leaves the greeting out when the agent has none", async () => {
    await createContextAsTester("active", { greetingMessage: null })

    const response = await subject()

    expectSchemaResponse(EvalReviewCampaignsRoutes.getContext, response)
    expect(response.body.data.agent).not.toHaveProperty("greetingMessage")
  })

  it("still answers on a closed campaign", async () => {
    await createContextAsTester("closed")
    expectSchemaResponse(EvalReviewCampaignsRoutes.getContext, await subject())
  })

  it("refuses a draft campaign", async () => {
    await createContextAsTester("draft")
    expectResponse(await subject(), 403, reviewCampaignStatusErrorMessage("draft"))
  })
})
