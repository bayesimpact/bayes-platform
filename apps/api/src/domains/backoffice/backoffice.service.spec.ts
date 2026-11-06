import {
  BACKOFFICE_PROJECT_READ_PERMISSION,
  BACKOFFICE_PROJECT_UPDATE_PERMISSION,
} from "@caseai-connect/api-contracts"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { userFactory } from "@/domains/users/user.factory"
import {
  assignPlatformStaffToUser,
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../test/rbac-test.helpers"
import { BackofficeModule } from "./backoffice.module"
import { BackofficeService } from "./backoffice.service"

describe("BackofficeService", () => {
  let service: BackofficeService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [BackofficeModule, RbacModule],
      applyOverrides: (moduleBuilder) => moduleBuilder,
    })
    await ensureRbacCatalog(setup.module)
    await clearTestDatabase(setup.dataSource)
    repositories = setup.getAllRepositories()
    service = setup.module.get<BackofficeService>(BackofficeService)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  afterEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  const createViewer = async (assignGlobalRole: typeof assignPlatformStaffToUser) => {
    const viewer = await repositories.userRepository.save(userFactory.build())
    await assignGlobalRole({ repositories, user: viewer })
    return viewer
  }

  describe("listProjects", () => {
    const listPermissionsByProjectId = async (userId: string) => {
      const { projects } = await service.listProjects({ userId, page: 0, limit: 10 })
      return new Map(projects.map(({ project, permissions }) => [project.id, permissions]))
    }

    it("gives a platform superadmin the update permission on every project", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const viewer = await createViewer(assignPlatformSuperadminToUser)

      const permissionsByProjectId = await listPermissionsByProjectId(viewer.id)

      expect(permissionsByProjectId.get(project.id)).toEqual(
        expect.arrayContaining([
          BACKOFFICE_PROJECT_READ_PERMISSION,
          BACKOFFICE_PROJECT_UPDATE_PERMISSION,
        ]),
      )
    })

    it("gives platform staff the update permission only on the projects they administer", async () => {
      const { project: administeredProject } = await createOrganizationWithProject(repositories)
      const { project: otherProject } = await createOrganizationWithProject(repositories)
      const viewer = await createViewer(assignPlatformStaffToUser)
      await addUserToProject({
        repositories,
        project: administeredProject,
        user: viewer,
        membership: { roleKeys: ["project_admin"] },
      })

      const permissionsByProjectId = await listPermissionsByProjectId(viewer.id)

      expect(permissionsByProjectId.get(administeredProject.id)).toContain(
        BACKOFFICE_PROJECT_UPDATE_PERMISSION,
      )
      expect(permissionsByProjectId.get(otherProject.id)).toContain(
        BACKOFFICE_PROJECT_READ_PERMISSION,
      )
      expect(permissionsByProjectId.get(otherProject.id)).not.toContain(
        BACKOFFICE_PROJECT_UPDATE_PERMISSION,
      )
    })
  })

  describe("getProjectDetail", () => {
    it("gives platform staff no update permission on a project they are not a member of", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const viewer = await createViewer(assignPlatformStaffToUser)

      const detail = await service.getProjectDetail({
        requestingUserId: viewer.id,
        targetProjectId: project.id,
      })

      expect(detail?.permissions).toContain(BACKOFFICE_PROJECT_READ_PERMISSION)
      expect(detail?.permissions).not.toContain(BACKOFFICE_PROJECT_UPDATE_PERMISSION)
    })
  })
})
