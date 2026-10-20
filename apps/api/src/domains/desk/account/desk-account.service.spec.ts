import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { DeskModule } from "../desk.module"
import { DeskAccountService } from "./desk-account.service"

describe("DeskAccountService", () => {
  let service: DeskAccountService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [DeskModule] })
    await ensureRbacCatalog(setup.module)
    await clearTestDatabase(setup.dataSource)
    repositories = setup.getAllRepositories()
    service = setup.module.get<DeskAccountService>(DeskAccountService)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  afterEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  describe("getMe", () => {
    it("lists a project member's project with its organization", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories, {
        projectMembership: { role: "member" },
      })

      const me = await service.getMe(user)

      expect(me.projects).toEqual([
        {
          id: project.id,
          name: project.name,
          organization: { id: organization.id, name: organization.name },
        },
      ])
    })

    it("leaves out a project whose organization the caller cannot read", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      // A project role with no organization membership: the organization is not readable.
      const { user } = await addUserToProject({
        repositories,
        project,
        membership: { role: "member" },
      })

      const me = await service.getMe(user)

      expect(me.projects).toEqual([])
    })
  })
})
