import {
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { InvitationPersistenceService } from "./invitation-persistence.service"
import { InvitationsPersistenceModule } from "./invitations-persistence.module"

describe("InvitationPersistenceService", () => {
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let service: InvitationPersistenceService

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [InvitationsPersistenceModule],
    })
    service = setup.module.get(InvitationPersistenceService)
  })

  beforeEach(async () => {
    await setup.startTransaction()
  })

  afterEach(async () => {
    await setup.rollbackTransaction()
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
  })

  it("creates and marks a pending project invitation as accepted", async () => {
    const repositories = setup.getAllRepositories()
    const { user, organization, project } = await createOrganizationWithProject(repositories)

    const invitation = await service.createPendingProjectInvitation({
      organizationId: organization.id,
      projectId: project.id,
      userId: user.id,
      invitedEmail: user.email,
      invitationToken: "ticket_integration_test",
      role: "admin",
    })

    expect(invitation.status).toBe("pending")
    expect(invitation.targetType).toBe("project")

    await service.markAcceptedByToken("ticket_integration_test")

    const updated = await repositories.invitationRepository.findOneOrFail({
      where: { id: invitation.id },
    })
    expect(updated.status).toBe("accepted")
    expect(updated.acceptedAt).not.toBeNull()
  })
})
