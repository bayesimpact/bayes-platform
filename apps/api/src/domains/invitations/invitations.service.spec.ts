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
})
