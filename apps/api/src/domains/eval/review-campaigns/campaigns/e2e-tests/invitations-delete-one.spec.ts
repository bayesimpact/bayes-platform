import { randomUUID } from "node:crypto"
import { EvalCampaignInvitationsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
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
import { expectResponse } from "../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation campaign invitations - deleteOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

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
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
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

  /** An active campaign and a pending invitation to it of a person with the given sign-in. */
  const createContext = async (invitee: { authSubject: string | null }) => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    const invitedUser = await repositories.userRepository.save(userFactory.build(invitee))
    const invitation = await repositories.invitationRepository.save(
      invitationFactory.transient({ user: invitedUser, reviewCampaign: campaign }).build(),
    )
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    return { organization, project, agent, agentSettings, invitedUser, invitation }
  }

  const subject = (invitationId: string) =>
    request({
      route: EvalCampaignInvitationsRoutes.deleteOne,
      pathParams: { organizationId, projectId, reviewCampaignId, invitationId },
      token: "token",
    })

  it("revokes the invitation and removes the account of a person who never signed in", async () => {
    const { invitedUser, invitation } = await createContext({ authSubject: null })

    const response = await subject(invitation.id)

    expectSchemaResponse(EvalCampaignInvitationsRoutes.deleteOne, response)
    expect(response.body.data).toStrictEqual({ success: true })
    expect(
      (await repositories.invitationRepository.findOneByOrFail({ id: invitation.id })).status,
    ).toBe("revoked")
    expect(await repositories.userRepository.findOneBy({ id: invitedUser.id })).toBeNull()
    await expectActivityCreated("invitation.revoke", { organizationId, projectId })
  })

  it("keeps the account of a person who already signed in", async () => {
    const { invitedUser, invitation } = await createContext({ authSubject: `oidc|${randomUUID()}` })

    expectSchemaResponse(EvalCampaignInvitationsRoutes.deleteOne, await subject(invitation.id))
    expect(await repositories.userRepository.findOneBy({ id: invitedUser.id })).not.toBeNull()
  })

  it("answers 404 for an invitation that is no longer pending", async () => {
    const { invitation } = await createContext({ authSubject: null })
    await repositories.invitationRepository.update({ id: invitation.id }, { status: "accepted" })

    expectResponse(await subject(invitation.id), 404)
  })

  it("answers 404 for an invitation to another campaign", async () => {
    const { organization, project, agent, agentSettings } = await createContext({
      authSubject: null,
    })
    const otherCampaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    const otherUser = await repositories.userRepository.save(
      userFactory.build({ authSubject: null }),
    )
    const otherInvitation = await repositories.invitationRepository.save(
      invitationFactory.transient({ user: otherUser, reviewCampaign: otherCampaign }).build(),
    )

    expectResponse(await subject(otherInvitation.id), 404)
    expect(
      (await repositories.invitationRepository.findOneByOrFail({ id: otherInvitation.id })).status,
    ).toBe("pending")
  })

  it("answers 400 for an invitation id that is not a UUID", async () => {
    await createContext({ authSubject: null })
    expectResponse(await subject("not-a-uuid"), 400)
  })
})
