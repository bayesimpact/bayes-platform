import { randomUUID } from "node:crypto"
import { EvalCampaignInvitationsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { invitationFactory } from "@/domains/invitations/invitation.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation campaign invitations - getAll", () => {
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

  const subject = () =>
    request({
      route: EvalCampaignInvitationsRoutes.getAll,
      pathParams: { organizationId, projectId, reviewCampaignId },
      token: "token",
    })

  it("lists the pending invitations of the campaign only", async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const [campaign, otherCampaign] = await repositories.reviewCampaignRepository.save([
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    ])
    if (!campaign || !otherCampaign) throw new Error("factory returned empty")
    const [pendingUser, acceptedUser, otherCampaignUser, projectUser] =
      await repositories.userRepository.save([
        userFactory.build({ authSubject: null }),
        userFactory.build(),
        userFactory.build({ authSubject: null }),
        userFactory.build({ authSubject: null }),
      ])
    if (!pendingUser || !acceptedUser || !otherCampaignUser || !projectUser)
      throw new Error("factory returned empty")
    const pending = await repositories.invitationRepository.save(
      invitationFactory
        .transient({ user: pendingUser, reviewCampaign: campaign })
        .build({ role: "reviewer" }),
    )
    await repositories.invitationRepository.save([
      invitationFactory
        .accepted()
        .transient({ user: acceptedUser, reviewCampaign: campaign })
        .build(),
      invitationFactory
        .transient({ user: otherCampaignUser, reviewCampaign: otherCampaign })
        .build(),
      invitationFactory.transient({ user: projectUser, project }).build(),
    ])
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id

    const response = await subject()

    expectSchemaResponse(EvalCampaignInvitationsRoutes.getAll, response)
    expect(response.body.data.invitations).toStrictEqual([
      {
        id: pending.id,
        invitedEmail: pendingUser.email,
        role: "reviewer",
        status: "pending",
        invitedAt: pending.invitedAt.getTime(),
      },
    ])
  })
})
