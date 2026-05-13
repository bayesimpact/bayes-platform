import { randomUUID } from "node:crypto"
import { InvitationsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { addUserToAgent } from "@/domains/agents/memberships/agent-membership.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { userFactory } from "@/domains/users/user.factory"
import { mockForeignAuth0Id, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { projectMembershipFactory } from "../../projects/memberships/project-membership.factory"
import { InvitationsModule } from "../invitations.module"

describe("Invitations — authorization", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let projectId: string
  let invitationId: string

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [InvitationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
    projectId = ""
    invitationId = ""
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    projectId = project.id
    auth0Id = user.auth0Id
    return { user, organization, project }
  }

  describe("InvitationsRoutes.revokeOne", () => {
    const seedPendingProjectInvitation = async () => {
      const { user, organization, project } = await createOrganizationWithProject(repositories)
      projectId = project.id
      auth0Id = user.auth0Id
      const invitation = await repositories.invitationRepository.save(
        repositories.invitationRepository.create({
          organizationId: organization.id,
          projectId: project.id,
          targetType: "project",
          targetId: project.id,
          userId: null,
          invitedEmail: "revoke-auth@example.com",
          invitationToken: `e2e-revoke-auth-${randomUUID()}`,
          status: "pending",
          role: "admin",
          invitedAt: new Date(),
          acceptedAt: null,
        }),
      )
      invitationId = invitation.id
    }

    const subject = async () =>
      request({
        route: InvitationsRoutes.revokeOne,
        pathParams: { invitationId },
        token: accessToken,
      })

    it("rejects unauthenticated requests", async () => {
      await seedPendingProjectInvitation()
      accessToken = undefined
      const response = await subject()
      expectResponse(response, 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("forbids a user who is not an organization member", async () => {
      await seedPendingProjectInvitation()
      auth0Id = mockForeignAuth0Id()
      const response = await subject()
      expectResponse(response, 403, "You do not have access to this organization")
    })

    it("forbids project member without admin role", async () => {
      const { project, organization } = await createOrganizationWithProject(repositories)
      projectId = project.id

      const savedInvitation = await repositories.invitationRepository.save(
        repositories.invitationRepository.create({
          organizationId: organization.id,
          projectId: project.id,
          targetType: "project",
          targetId: project.id,
          userId: null,
          invitedEmail: "revoke-member@example.com",
          invitationToken: `e2e-revoke-member-${randomUUID()}`,
          status: "pending",
          role: "admin",
          invitedAt: new Date(),
          acceptedAt: null,
        }),
      )
      invitationId = savedInvitation.id

      const memberUser = userFactory.build()
      await repositories.userRepository.save(memberUser)
      await repositories.projectMembershipRepository.save(
        projectMembershipFactory
          .member()
          .transient({ project, user: memberUser })
          .build({ status: "accepted" }),
      )
      await repositories.organizationMembershipRepository.save(
        repositories.organizationMembershipRepository.create({
          userId: memberUser.id,
          organizationId: organization.id,
          role: "member",
        }),
      )

      auth0Id = memberUser.auth0Id
      const response = await subject()
      expectResponse(response, 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("InvitationsRoutes.listPendingMine", () => {
    it("rejects unauthenticated requests", async () => {
      accessToken = undefined
      const response = await request({
        route: InvitationsRoutes.listPendingMine,
        token: accessToken,
      })
      expectResponse(response, 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
  })

  describe("InvitationsRoutes.listForTarget", () => {
    const subject = async (query: Record<string, string>) =>
      request({
        route: InvitationsRoutes.listForTarget,
        token: accessToken,
        query,
      })

    it("rejects unauthenticated requests", async () => {
      await createContext()
      accessToken = undefined
      const response = await subject({ targetType: "project", targetId: projectId })
      expectResponse(response, 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("returns 400 when query params are missing", async () => {
      await createContext()
      const response = await request({
        route: InvitationsRoutes.listForTarget,
        token: accessToken,
        query: { targetType: "project" },
      })
      expectResponse(response, 400)
    })

    it("returns 400 for invalid targetType", async () => {
      await createContext()
      const response = await subject({ targetType: "not_a_type", targetId: projectId })
      expectResponse(response, 400)
    })

    it("allows project admin to list pending invitations for the project", async () => {
      await createContext()
      const response = await subject({ targetType: "project", targetId: projectId })
      expectResponse(response, 200)
      expect(response.body.data.invitations).toEqual([])
    })

    it("forbids project member (non-admin) from listing invitations", async () => {
      const { project, organization } = await createOrganizationWithProject(repositories)
      projectId = project.id

      const memberUser = userFactory.build()
      await repositories.userRepository.save(memberUser)
      await repositories.projectMembershipRepository.save(
        projectMembershipFactory
          .member()
          .transient({ project, user: memberUser })
          .build({ status: "accepted" }),
      )
      await repositories.organizationMembershipRepository.save(
        repositories.organizationMembershipRepository.create({
          userId: memberUser.id,
          organizationId: organization.id,
          role: "member",
        }),
      )

      auth0Id = memberUser.auth0Id
      const response = await subject({ targetType: "project", targetId: projectId })
      expectResponse(response, 403)
    })

    describe("agent target", () => {
      it("allows agent admin to list invitations", async () => {
        const { user, organization, project } = await createOrganizationWithProject(repositories)
        auth0Id = user.auth0Id
        const agent = await repositories.agentRepository.save(
          agentFactory.transient({ organization, project }).build(),
        )
        await addUserToAgent({
          repositories,
          agent,
          user,
          membership: { role: "admin" },
        })

        const response = await subject({ targetType: "agent", targetId: agent.id })
        expectResponse(response, 200)
        expect(response.body.data.invitations).toEqual([])
      })

      it("forbids a user with no agent membership from listing invitations", async () => {
        const { organization, project } = await createOrganizationWithProject(repositories)
        const agent = await repositories.agentRepository.save(
          agentFactory.transient({ organization, project }).build(),
        )

        const nonMemberUser = userFactory.build()
        await repositories.userRepository.save(nonMemberUser)
        await repositories.organizationMembershipRepository.save(
          repositories.organizationMembershipRepository.create({
            userId: nonMemberUser.id,
            organizationId: organization.id,
            role: "member",
          }),
        )
        await repositories.projectMembershipRepository.save(
          projectMembershipFactory
            .member()
            .transient({ project, user: nonMemberUser })
            .build({ status: "accepted" }),
        )

        auth0Id = nonMemberUser.auth0Id
        const response = await subject({ targetType: "agent", targetId: agent.id })
        expectResponse(response, 403)
      })

      it("forbids an agent member (non-admin) from listing invitations", async () => {
        const { organization, project } = await createOrganizationWithProject(repositories)
        const agent = await repositories.agentRepository.save(
          agentFactory.transient({ organization, project }).build(),
        )

        const memberUser = userFactory.build()
        await repositories.userRepository.save(memberUser)
        await repositories.organizationMembershipRepository.save(
          repositories.organizationMembershipRepository.create({
            userId: memberUser.id,
            organizationId: organization.id,
            role: "member",
          }),
        )
        await repositories.projectMembershipRepository.save(
          projectMembershipFactory
            .member()
            .transient({ project, user: memberUser })
            .build({ status: "accepted" }),
        )
        await addUserToAgent({
          repositories,
          agent,
          user: memberUser,
          membership: { role: "member" },
        })

        auth0Id = memberUser.auth0Id
        const response = await subject({ targetType: "agent", targetId: agent.id })
        expectResponse(response, 403)
      })
    })

    describe("review_campaign target", () => {
      it("allows project admin to list invitations for a review campaign", async () => {
        const { user, organization, project } = await createOrganizationWithProject(repositories)
        auth0Id = user.auth0Id
        const agent = await repositories.agentRepository.save(
          agentFactory.transient({ organization, project }).build(),
        )
        const reviewCampaign = await repositories.reviewCampaignRepository.save(
          reviewCampaignFactory.transient({ organization, project, agent }).build(),
        )

        const response = await subject({
          targetType: "review_campaign",
          targetId: reviewCampaign.id,
        })
        expectResponse(response, 200)
        expect(response.body.data.invitations).toEqual([])
      })

      it("forbids project member (non-admin) from listing review campaign invitations", async () => {
        const { organization, project } = await createOrganizationWithProject(repositories)
        const agent = await repositories.agentRepository.save(
          agentFactory.transient({ organization, project }).build(),
        )
        const reviewCampaign = await repositories.reviewCampaignRepository.save(
          reviewCampaignFactory.transient({ organization, project, agent }).build(),
        )

        const memberUser = userFactory.build()
        await repositories.userRepository.save(memberUser)
        await repositories.organizationMembershipRepository.save(
          repositories.organizationMembershipRepository.create({
            userId: memberUser.id,
            organizationId: organization.id,
            role: "member",
          }),
        )
        await repositories.projectMembershipRepository.save(
          projectMembershipFactory
            .member()
            .transient({ project, user: memberUser })
            .build({ status: "accepted" }),
        )

        auth0Id = memberUser.auth0Id
        const response = await subject({
          targetType: "review_campaign",
          targetId: reviewCampaign.id,
        })
        expectResponse(response, 403)
      })
    })
  })
})
