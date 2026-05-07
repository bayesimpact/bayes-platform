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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
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
  })
})
