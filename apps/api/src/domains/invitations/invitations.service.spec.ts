import { randomUUID } from "node:crypto"
import { ConflictException, NotFoundException } from "@nestjs/common"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../test/e2e.helpers"
import { InvitationsModule } from "./invitations.module"
import { InvitationsService } from "./invitations.service"

describe("InvitationsService", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let service: InvitationsService

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [InvitationsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => "auth0|invitations-service-spec"),
    })
    service = setup.module.get(InvitationsService)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  it("listPendingMine returns an empty list when there are no invitations", async () => {
    const repositories = setup.getAllRepositories()
    const { user } = await createOrganizationWithProject(repositories)

    await expect(
      service.listPendingMine({ userId: user.id, userEmail: user.email }),
    ).resolves.toEqual([])
  })

  // ─── revokeOne ────────────────────────────────────────────────────────────

  describe("revokeOne", () => {
    const seedInvitation = async (
      status: "pending" | "accepted" | "revoked",
      repositories: ReturnType<typeof setup.getAllRepositories>,
    ) => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      return repositories.invitationRepository.save({
        organizationId: organization.id,
        projectId: project.id,
        targetType: "project",
        targetId: project.id,
        userId: null,
        invitedEmail: "someone@example.com",
        role: "admin",
        invitationToken: `token-${status}`,
        status,
        invitedAt: new Date(),
        acceptedAt: status === "accepted" ? new Date() : null,
      })
    }

    it("throws NotFoundException when the invitation does not exist", async () => {
      await expect(service.revokeOne({ invitationId: randomUUID() })).rejects.toThrow(
        NotFoundException,
      )
    })

    it("throws ConflictException when the invitation has already been accepted", async () => {
      const repositories = setup.getAllRepositories()
      const invitation = await seedInvitation("accepted", repositories)

      await expect(service.revokeOne({ invitationId: invitation.id })).rejects.toThrow(
        ConflictException,
      )
    })

    it("throws ConflictException when the invitation is already revoked", async () => {
      const repositories = setup.getAllRepositories()
      const invitation = await seedInvitation("revoked", repositories)

      await expect(service.revokeOne({ invitationId: invitation.id })).rejects.toThrow(
        ConflictException,
      )
    })
  })
})
