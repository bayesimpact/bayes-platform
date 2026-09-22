import { randomUUID } from "node:crypto"
import { UnauthorizedException } from "@nestjs/common"
import type { Repository } from "typeorm"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import type { Auth0UserInfoResponse } from "@/domains/auth/auth0-userinfo.service"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import {
  findOrganizationMembershipRow,
  findProjectMembershipRow,
} from "../../../test/membership-test.helpers"
import { ensureRbacCatalog } from "../../../test/rbac-test.helpers"
import { buildServiceUserAuth0Id, buildServiceUserEmail } from "./service-user.helpers"
import { User } from "./user.entity"
import { userFactory } from "./user.factory"
import { UserRepository } from "./user.repository"
import { USER_TYPE_HUMAN, USER_TYPE_SERVICE } from "./user.types"
import { UsersService } from "./users.service"

describe("UsersService", () => {
  let service: UsersService
  let repository: Repository<User>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      providers: [UsersService, UserRepository],
      additionalImports: [RbacModule, MembershipsModule],
    })
    await ensureRbacCatalog(setup.module)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get<UsersService>(UsersService)
    repository = setup.getRepository(User)
    repositories = setup.getAllRepositories()
  })

  describe("findByAuth0Id", () => {
    it("should return null when user does not exist", async () => {
      const result = await service.findByAuth0Id("auth0|nonexistent")
      expect(result).toBeNull()
    })

    it("should return user when it exists", async () => {
      const user = userFactory.build({
        auth0Id: "auth0|user-123",
        email: "test@example.com",
      })
      await repository.save(user)

      const result = await service.findByAuth0Id("auth0|user-123")
      expect(result).not.toBeNull()
      expect(result?.id).toBe(user.id)
      expect(result?.auth0Id).toBe("auth0|user-123")
      expect(result?.email).toBe("test@example.com")
    })
  })

  describe("findById", () => {
    it("should return null when user does not exist", async () => {
      const result = await service.findById("00000000-0000-0000-0000-000000000000")
      expect(result).toBeNull()
    })

    it("should return user when it exists", async () => {
      const user = userFactory.build({
        auth0Id: "auth0|user-findbyid-test",
        email: "test@example.com",
      })
      const savedUser = await repository.save(user)

      const result = await service.findById(savedUser.id)
      expect(result).not.toBeNull()
      expect(result?.id).toBe(savedUser.id)
      expect(result?.email).toBe("test@example.com")
    })
  })

  describe("create", () => {
    it("should create a new user", async () => {
      const auth0UserInfo = {
        sub: "auth0|user-new-user",
        email: "newuser@example.com",
        name: "New User",
        picture: "https://example.com/picture.jpg",
      }

      const user = await service.create(auth0UserInfo)

      expect(user.id).toBeDefined()
      expect(user.auth0Id).toBe("auth0|user-new-user")
      expect(user.email).toBe("newuser@example.com")
      expect(user.name).toBe("New User")
      expect(user.pictureUrl).toBe("https://example.com/picture.jpg")
      expect(user.type).toBe(USER_TYPE_HUMAN)
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
    })

    it("should throw error when email is not provided", async () => {
      const auth0UserInfo = {
        sub: "auth0|no-email",
      }

      await expect(service.create(auth0UserInfo)).rejects.toThrow(
        "Email is required from Auth0 token",
      )
    })

    it("should create user with null values for optional fields", async () => {
      const auth0UserInfo = {
        sub: "auth0|minimal",
        email: "minimal@example.com",
      }

      const user = await service.create(auth0UserInfo)

      expect(user.name).toBeNull()
      expect(user.pictureUrl).toBeNull()
    })

    it("should persist user to database", async () => {
      const auth0UserInfo = {
        sub: "auth0|persisted",
        email: "persisted@example.com",
      }

      const user = await service.create(auth0UserInfo)

      // Use service to find the user (both use the same transactional repository)
      const foundUser = await service.findById(user.id)
      expect(foundUser).not.toBeNull()
      expect(foundUser?.auth0Id).toBe("auth0|persisted")
    })
  })

  describe("updateUser", () => {
    it("should update the user name and return the updated user", async () => {
      const user = userFactory.build({ name: "Original Name" })
      await repository.save(user)

      const updated = await service.updateUser(user.id, "Updated Name")

      expect(updated.id).toBe(user.id)
      expect(updated.name).toBe("Updated Name")

      const persisted = await repository.findOne({ where: { id: user.id } })
      expect(persisted?.name).toBe("Updated Name")
    })

    it("should throw when user does not exist", async () => {
      await expect(
        service.updateUser("00000000-0000-0000-0000-000000000000", "New Name"),
      ).rejects.toThrow("User 00000000-0000-0000-0000-000000000000 not found after update")
    })
  })

  describe("findOrCreate", () => {
    it("should create user when it does not exist", async () => {
      const auth0UserInfo = {
        sub: "auth0|create-new",
        email: "create@example.com",
        name: "Create User",
      }

      const user = await service.findOrCreate({
        sub: auth0UserInfo.sub,
        getUserInfo: () =>
          Promise.resolve({
            sub: auth0UserInfo.sub,
            email: auth0UserInfo.email,
            name: auth0UserInfo.name,
          } as Auth0UserInfoResponse),
      })

      expect(user.auth0Id).toBe("auth0|create-new")
      expect(user.email).toBe("create@example.com")
      expect(user.name).toBe("Create User")

      // Verify it was saved - use service to query (both use same transaction)
      const found = await service.findByAuth0Id("auth0|create-new")
      expect(found).not.toBeNull()
      expect(found?.id).toBe(user.id)
    })

    it("should return existing user when it exists", async () => {
      const existingUser = userFactory.build({
        auth0Id: "auth0|user-existing",
        email: "existing@example.com",
        name: "Existing User",
      })
      await repository.save(existingUser)

      const auth0UserInfo = {
        sub: "auth0|user-existing",
        email: "existing@example.com",
        name: "Existing User",
      }

      const user = await service.findOrCreate({
        sub: auth0UserInfo.sub,
        getUserInfo: () => Promise.resolve({} as Auth0UserInfoResponse),
      })

      expect(user.id).toBe(existingUser.id)
      expect(user.email).toBe("existing@example.com")

      // Verify no duplicate was created
      const count = await repository.count({ where: { auth0Id: "auth0|user-existing" } })
      expect(count).toBe(1)
    })

    it("links an existing human user found by email to the Auth0 subject", async () => {
      const existingUser = userFactory.build({
        auth0Id: "auth0|placeholder",
        email: "invitee@example.com",
        type: USER_TYPE_HUMAN,
      })
      await repository.save(existingUser)

      const user = await service.findOrCreate({
        sub: "auth0|real-subject",
        getUserInfo: () =>
          Promise.resolve({
            sub: "auth0|real-subject",
            email: "invitee@example.com",
            name: "Invitee",
          } as Auth0UserInfoResponse),
      })

      expect(user.id).toBe(existingUser.id)
      expect(user.auth0Id).toBe("auth0|real-subject")
    })

    it("refuses to attach a real Auth0 subject to a service user with the same email", async () => {
      const installationId = "22222222-2222-4222-8222-222222222222"
      const serviceUser = userFactory.build({
        auth0Id: buildServiceUserAuth0Id(installationId),
        email: buildServiceUserEmail("helpful-assistant", installationId),
        type: USER_TYPE_SERVICE,
      })
      await repository.save(serviceUser)

      await expect(
        service.findOrCreate({
          sub: "auth0|human-subject",
          getUserInfo: () =>
            Promise.resolve({
              sub: "auth0|human-subject",
              email: serviceUser.email,
              name: "Human",
            } as Auth0UserInfoResponse),
        }),
      ).rejects.toThrow(AUTH_ERRORS.SERVICE_USERS_CANNOT_AUTHENTICATE)

      const persisted = await repository.findOneOrFail({ where: { id: serviceUser.id } })
      expect(persisted.auth0Id).toBe(serviceUser.auth0Id)
      expect(persisted.type).toBe(USER_TYPE_SERVICE)
    })

    it("refuses Auth0 login when the subject is a service user identity", async () => {
      await expect(
        service.findOrCreate({
          sub: buildServiceUserAuth0Id("33333333-3333-4333-8333-333333333333"),
          getUserInfo: () => Promise.resolve({} as Auth0UserInfoResponse),
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })

  describe("createServiceUser", () => {
    it("creates a service user with a synthetic email and auth0 id", async () => {
      const installationId = "44444444-4444-4444-8444-444444444444"
      const user = await service.createServiceUser({
        appSlug: "Helpful-Assistant",
        installationId,
      })

      expect(user.type).toBe(USER_TYPE_SERVICE)
      expect(user.email).toBe(buildServiceUserEmail("helpful-assistant", installationId))
      expect(user.auth0Id).toBe(buildServiceUserAuth0Id(installationId))
      expect(user.name).toBe("Helpful-Assistant")
    })
  })

  describe("attachServiceUserMemberships", () => {
    it("attaches org_member and a project member membership with the custom role", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const installationId = randomUUID()
      const serviceUser = await service.createServiceUser({
        appSlug: "helpful-assistant",
        installationId,
      })
      const customRole = await repositories.roleRepository.save(
        repositories.roleRepository.create({
          key: `app_install_${installationId}`,
          name: "App install",
          scopeType: "project",
        }),
      )

      await service.attachServiceUserMemberships({
        userId: serviceUser.id,
        organizationId: organization.id,
        projectId: project.id,
        customRoleId: customRole.id,
      })

      const organizationMembership = await findOrganizationMembershipRow(repositories, {
        userId: serviceUser.id,
        organizationId: organization.id,
      })
      const projectMembership = await findProjectMembershipRow(repositories, {
        userId: serviceUser.id,
        projectId: project.id,
      })
      const orgMemberRole = await repositories.roleRepository.findOneOrFail({
        where: { key: ORGANIZATION_ROLES.member },
      })

      expect(organizationMembership?.role).toBe("member")
      expect(organizationMembership?.roleId).toBe(orgMemberRole.id)
      expect(projectMembership?.role).toBe("member")
      expect(projectMembership?.role).not.toBe("admin")
      expect(projectMembership?.roleId).toBe(customRole.id)
    })

    it("refuses to attach memberships for a human user", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)

      await expect(
        service.attachServiceUserMemberships({
          userId: user.id,
          organizationId: organization.id,
          projectId: project.id,
          customRoleId: "00000000-0000-4000-8000-000000000000",
        }),
      ).rejects.toThrow("Only service users can be attached as app installations")
    })
  })
})
