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
import type { OidcUserInfo } from "@/domains/auth/oidc-userinfo.service"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import {
  findOrganizationMembershipRow,
  findProjectMembershipRow,
} from "../../../test/membership-test.helpers"
import { ensureRbacCatalog } from "../../../test/rbac-test.helpers"
import { buildServiceUserAuthSubject, buildServiceUserEmail } from "./service-user.helpers"
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

  describe("findByAuthSubject", () => {
    it("should return null when user does not exist", async () => {
      const result = await service.findByAuthSubject("oidc|nonexistent")
      expect(result).toBeNull()
    })

    it("should return user when it exists", async () => {
      const user = userFactory.build({
        authSubject: "oidc|user-123",
        email: "test@example.com",
      })
      await repository.save(user)

      const result = await service.findByAuthSubject("oidc|user-123")
      expect(result).not.toBeNull()
      expect(result?.id).toBe(user.id)
      expect(result?.authSubject).toBe("oidc|user-123")
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
        authSubject: "oidc|user-findbyid-test",
        email: "test@example.com",
      })
      const savedUser = await repository.save(user)

      const result = await service.findById(savedUser.id)
      expect(result).not.toBeNull()
      expect(result?.id).toBe(savedUser.id)
      expect(result?.email).toBe("test@example.com")
    })
  })

  describe("findOrCreateByEmail", () => {
    it("creates a never-signed-in user for an unknown email", async () => {
      const user = await service.findOrCreateByEmail({
        email: " New.Member@Example.com ",
        name: "New Member",
      })

      expect(user.authSubject).toBeNull()
      expect(user.email).toBe("new.member@example.com")
      expect(user.name).toBe("New Member")
      expect(user.type).toBe(USER_TYPE_HUMAN)
    })

    it("returns the existing user for a known email", async () => {
      const existingUser = await repository.save(userFactory.build({ email: "known@example.com" }))

      const user = await service.findOrCreateByEmail({ email: "known@example.com" })

      expect(user.id).toBe(existingUser.id)
      expect(await repository.count({ where: { email: "known@example.com" } })).toBe(1)
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
    const linkingAllowed = { allowEmailLinking: true, trustUnverifiedEmail: false }

    const signIn = (
      userInfo: OidcUserInfo,
      emailLinkingPolicy: {
        allowEmailLinking: boolean
        trustUnverifiedEmail: boolean
      } = linkingAllowed,
    ) =>
      service.findOrCreate({
        sub: userInfo.sub,
        getUserInfo: () => Promise.resolve(userInfo),
        emailLinkingPolicy,
      })

    it("creates a user without access on a first sign-in with an unknown email", async () => {
      const user = await signIn({
        sub: "oidc|create-new",
        email: "Create@Example.com",
        email_verified: true,
        name: "Create User",
      })

      expect(user.authSubject).toBe("oidc|create-new")
      expect(user.email).toBe("create@example.com")
      expect(user.name).toBe("Create User")
      expect((await service.findByAuthSubject("oidc|create-new"))?.id).toBe(user.id)
    })

    it("returns the known user without calling userinfo", async () => {
      const existingUser = await repository.save(
        userFactory.build({ authSubject: "oidc|user-existing", email: "existing@example.com" }),
      )
      const getUserInfo = jest.fn()

      const user = await service.findOrCreate({ sub: "oidc|user-existing", getUserInfo })

      expect(user.id).toBe(existingUser.id)
      expect(getUserInfo).not.toHaveBeenCalled()
    })

    it("links a member added by email when the provider verified the email", async () => {
      const addedUser = await repository.save(
        userFactory.build({ authSubject: null, email: "added@example.com", name: "Set By Admin" }),
      )

      const user = await signIn({
        sub: "oidc|real-subject",
        email: "added@example.com",
        email_verified: true,
        picture: "https://example.com/picture.jpg",
      })

      expect(user.id).toBe(addedUser.id)
      expect(user.authSubject).toBe("oidc|real-subject")
      expect(user.name).toBe("Set By Admin")
      expect(user.pictureUrl).toBe("https://example.com/picture.jpg")
    })

    it("links an account moved from another provider when the email is verified", async () => {
      const existingUser = await repository.save(
        userFactory.build({ authSubject: "oidc|previous-provider", email: "moved@example.com" }),
      )

      const user = await signIn({
        sub: "oidc|new-provider",
        email: "moved@example.com",
        email_verified: true,
      })

      expect(user.id).toBe(existingUser.id)
      expect(user.authSubject).toBe("oidc|new-provider")
    })

    it("refuses to link when the provider does not report the email as verified", async () => {
      const addedUser = await repository.save(
        userFactory.build({ authSubject: null, email: "unverified@example.com" }),
      )

      await expect(
        signIn({ sub: "oidc|unverified", email: "unverified@example.com", email_verified: false }),
      ).rejects.toThrow(AUTH_ERRORS.EMAIL_NOT_VERIFIED)
      await expect(
        signIn({ sub: "oidc|unverified", email: "unverified@example.com" }),
      ).rejects.toThrow(AUTH_ERRORS.EMAIL_NOT_VERIFIED)

      const persisted = await repository.findOneOrFail({ where: { id: addedUser.id } })
      expect(persisted.authSubject).toBeNull()
    })

    it("links an unverified email when the instance trusts the provider", async () => {
      const addedUser = await repository.save(
        userFactory.build({ authSubject: null, email: "trusted@example.com" }),
      )

      const user = await signIn(
        { sub: "oidc|trusted", email: "trusted@example.com" },
        { allowEmailLinking: true, trustUnverifiedEmail: true },
      )

      expect(user.id).toBe(addedUser.id)
    })

    it("refuses to link when email linking is disabled", async () => {
      await repository.save(userFactory.build({ authSubject: null, email: "nolink@example.com" }))

      await expect(
        signIn(
          { sub: "oidc|nolink", email: "nolink@example.com", email_verified: true },
          { allowEmailLinking: false, trustUnverifiedEmail: false },
        ),
      ).rejects.toThrow(AUTH_ERRORS.EMAIL_LINKING_DISABLED)
    })

    it("refuses a userinfo response for another subject", async () => {
      await expect(
        service.findOrCreate({
          sub: "oidc|token-subject",
          getUserInfo: () =>
            Promise.resolve({
              sub: "oidc|other-subject",
              email: "other@example.com",
              email_verified: true,
            }),
          emailLinkingPolicy: linkingAllowed,
        }),
      ).rejects.toThrow(AUTH_ERRORS.INVALID_ACCESS_TOKEN)
    })

    it("refuses a sign-in without email", async () => {
      await expect(signIn({ sub: "oidc|no-email" })).rejects.toThrow(AUTH_ERRORS.EMAIL_REQUIRED)
    })

    it("refuses to attach a human subject to a service user with the same email", async () => {
      const installationId = "22222222-2222-4222-8222-222222222222"
      const serviceUser = await repository.save(
        userFactory.build({
          authSubject: buildServiceUserAuthSubject(installationId),
          email: buildServiceUserEmail("helpful-assistant", installationId),
          type: USER_TYPE_SERVICE,
        }),
      )

      await expect(
        signIn({ sub: "oidc|human-subject", email: serviceUser.email, email_verified: true }),
      ).rejects.toThrow(AUTH_ERRORS.SERVICE_USERS_CANNOT_AUTHENTICATE)

      const persisted = await repository.findOneOrFail({ where: { id: serviceUser.id } })
      expect(persisted.authSubject).toBe(serviceUser.authSubject)
      expect(persisted.type).toBe(USER_TYPE_SERVICE)
    })

    it("refuses a sign-in whose subject is a service user identity", async () => {
      await expect(
        service.findOrCreate({
          sub: buildServiceUserAuthSubject("33333333-3333-4333-8333-333333333333"),
          getUserInfo: () => Promise.resolve({} as OidcUserInfo),
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })

  describe("createServiceUser", () => {
    it("creates a service user with a synthetic email and subject", async () => {
      const installationId = "44444444-4444-4444-8444-444444444444"
      const user = await service.createServiceUser({
        appSlug: "Helpful-Assistant",
        installationId,
      })

      expect(user.type).toBe(USER_TYPE_SERVICE)
      expect(user.email).toBe(buildServiceUserEmail("helpful-assistant", installationId))
      expect(user.authSubject).toBe(buildServiceUserAuthSubject(installationId))
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
