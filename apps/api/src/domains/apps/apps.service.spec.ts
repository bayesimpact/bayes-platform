import { randomUUID } from "node:crypto"
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { ProjectRepository } from "@/domains/projects/project.repository"
import { PermissionService } from "@/domains/rbac/permission.service"
import { DOCUMENT_CREATE_PERMISSION, DOCUMENT_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UserRepository } from "@/domains/users/user.repository"
import { USER_TYPE_SERVICE } from "@/domains/users/user.types"
import { UsersService } from "@/domains/users/users.service"
import { assignPlatformStaffToUser, ensureRbacCatalog } from "../../../test/rbac-test.helpers"
import {
  APP_INSTALLATION_STATUS_ACTIVE,
  APP_INSTALLATION_STATUS_REVOKED,
} from "./app-installation.entity"
import { appInstallationFactory } from "./app-installation.factory"
import { AppInstallationRepository } from "./app-installation.repository"
import { AppJwtService } from "./app-jwt.service"
import { AppManifestRepository } from "./app-manifest.repository"
import { AppsService } from "./apps.service"

describe("AppsService", () => {
  let service: AppsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      providers: [
        AppsService,
        AppManifestRepository,
        AppInstallationRepository,
        ProjectRepository,
        UsersService,
        UserRepository,
        AppJwtService,
      ],
      additionalImports: [RbacModule, MembershipsModule],
    })
    await ensureRbacCatalog(setup.module)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get(AppsService)
  })

  const createPayload = {
    name: "Helpful Assistant",
    slug: "helpful-assistant",
    description: "A generic assistant used in tests.",
    logoUrl: null as string | null,
    grantablePermissions: [DOCUMENT_READ_PERMISSION, DOCUMENT_CREATE_PERMISSION],
  }

  it("creates, lists, and returns a manifest", async () => {
    const created = await service.createAppManifest(createPayload)

    expect(created.name).toBe("Helpful Assistant")
    expect(created.slug).toBe("helpful-assistant")
    expect(created.grantablePermissions).toEqual([
      DOCUMENT_READ_PERMISSION,
      DOCUMENT_CREATE_PERMISSION,
    ])

    const listed = await service.listAppManifests()
    expect(listed.map((manifest) => manifest.id)).toEqual([created.id])
    await expect(service.getAppManifest(created.id)).resolves.toMatchObject({
      id: created.id,
      slug: "helpful-assistant",
    })
  })

  it("stores unique grantable permissions and rejects unknown ones", async () => {
    const created = await service.createAppManifest({
      ...createPayload,
      slug: "deduped-assistant",
      grantablePermissions: [DOCUMENT_READ_PERMISSION, DOCUMENT_READ_PERMISSION],
    })
    expect(created.grantablePermissions).toEqual([DOCUMENT_READ_PERMISSION])

    await expect(
      service.createAppManifest({
        ...createPayload,
        slug: "invalid-assistant",
        grantablePermissions: [DOCUMENT_READ_PERMISSION, "organization.delete"],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException)
  })

  it("rejects a duplicate slug and allows reuse after soft-delete", async () => {
    await service.createAppManifest(createPayload)
    await expect(service.createAppManifest(createPayload)).rejects.toBeInstanceOf(ConflictException)

    const other = await service.createAppManifest({
      ...createPayload,
      slug: "other-assistant",
    })
    await expect(
      service.updateAppManifest(other.id, { slug: createPayload.slug }),
    ).rejects.toBeInstanceOf(ConflictException)

    const first = (await service.listAppManifests()).find(
      (manifest) => manifest.slug === createPayload.slug,
    )
    if (!first) throw new Error("expected the original manifest")
    await service.deleteAppManifest(first.id)
    await expect(service.createAppManifest(createPayload)).resolves.toMatchObject({
      slug: createPayload.slug,
    })
  })

  it("updates fields and refuses delete while an active installation exists", async () => {
    const created = await service.createAppManifest(createPayload)
    const updated = await service.updateAppManifest(created.id, {
      name: "Updated Assistant",
      grantablePermissions: [DOCUMENT_READ_PERMISSION],
    })
    expect(updated.name).toBe("Updated Assistant")
    expect(updated.grantablePermissions).toEqual([DOCUMENT_READ_PERMISSION])

    const repositories = setup.getAllRepositories()
    const { project } = await createOrganizationWithProject(repositories)
    await repositories.appInstallationRepository.save(
      appInstallationFactory.build({
        appManifestId: created.id,
        projectId: project.id,
        status: APP_INSTALLATION_STATUS_ACTIVE,
      }),
    )
    await expect(service.deleteAppManifest(created.id)).rejects.toBeInstanceOf(ConflictException)

    await repositories.appInstallationRepository.update(
      { appManifestId: created.id },
      { status: APP_INSTALLATION_STATUS_REVOKED },
    )
    await service.deleteAppManifest(created.id)
    await expect(service.getAppManifest(created.id)).rejects.toBeInstanceOf(NotFoundException)
  })

  it("throws not found for an unknown id", async () => {
    const unknownId = randomUUID()
    await expect(service.getAppManifest(unknownId)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.updateAppManifest(unknownId, { name: "Missing" })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    await expect(service.deleteAppManifest(unknownId)).rejects.toBeInstanceOf(NotFoundException)
  })

  it("authorizes an install with a hashed secret, custom role, and service user", async () => {
    const repositories = setup.getAllRepositories()
    const { project, user } = await createOrganizationWithProject(repositories)
    await assignPlatformStaffToUser({ repositories, user })
    const created = await service.createAppManifest(createPayload)
    const redirectUri = "http://127.0.0.1:8787/callback"

    const authorized = await service.authorizeInstall({
      slug: created.slug,
      userId: user.id,
      projectId: project.id,
      permissions: [DOCUMENT_READ_PERMISSION],
      redirectUri,
      state: "csrf-state",
    })

    expect(authorized.redirectUri).toBe(redirectUri)
    expect(authorized.state).toBe("csrf-state")
    expect(authorized.clientId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(authorized.clientSecret).toBeTruthy()

    const installation = await repositories.appInstallationRepository.findOneByOrFail({
      appManifestId: created.id,
      projectId: project.id,
    })
    expect(installation.clientId).toBe(authorized.clientId)
    expect(installation.clientSecretHash).not.toContain(authorized.clientSecret)
    expect(installation.createdByUserId).toBe(user.id)
    expect(installation.customRoleId).toBeTruthy()

    const serviceUser = await repositories.userRepository.findOneByOrFail({
      id: installation.serviceUserId ?? undefined,
    })
    expect(serviceUser.type).toBe(USER_TYPE_SERVICE)

    const permissionService = setup.module.get(PermissionService)
    await expect(
      permissionService.has(serviceUser.id, DOCUMENT_READ_PERMISSION, {
        type: "project",
        id: project.id,
      }),
    ).resolves.toBe(true)
    await expect(
      permissionService.has(serviceUser.id, DOCUMENT_CREATE_PERMISSION, {
        type: "project",
        id: project.id,
      }),
    ).resolves.toBe(false)

    const catalog = await permissionService.getCatalog()
    expect(catalog.roles.some((role) => role.key.startsWith("app_install_"))).toBe(false)

    await expect(
      service.authorizeInstall({
        slug: created.slug,
        userId: user.id,
        projectId: project.id,
        permissions: [DOCUMENT_READ_PERMISSION],
        redirectUri,
        state: "csrf-state",
      }),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it("issues an App JWT for valid client credentials and rejects a bad secret", async () => {
    const repositories = setup.getAllRepositories()
    const { project, user } = await createOrganizationWithProject(repositories)
    await assignPlatformStaffToUser({ repositories, user })
    const created = await service.createAppManifest(createPayload)
    const authorized = await service.authorizeInstall({
      slug: created.slug,
      userId: user.id,
      projectId: project.id,
      permissions: [DOCUMENT_READ_PERMISSION],
      redirectUri: "http://127.0.0.1:8787/callback",
      state: "csrf-state",
    })

    const token = await service.issueToken({
      grant_type: "client_credentials",
      client_id: authorized.clientId,
      client_secret: authorized.clientSecret,
    })
    expect(token.tokenType).toBe("Bearer")
    expect(token.expiresIn).toBe(3600)
    expect(token.accessToken.split(".")).toHaveLength(3)

    const principal = await service.resolveAppPrincipal(token.accessToken)
    expect(principal.projectId).toBe(project.id)
    expect(principal.user.type).toBe(USER_TYPE_SERVICE)

    await expect(
      service.issueToken({
        grant_type: "client_credentials",
        client_id: authorized.clientId,
        client_secret: "wrong-secret",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    await expect(
      service.issueToken({
        grant_type: "password",
        client_id: authorized.clientId,
        client_secret: authorized.clientSecret,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    await expect(
      service.issueToken({
        grant_type: "client_credentials",
        client_id: randomUUID(),
        client_secret: authorized.clientSecret,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    const stored = await repositories.appInstallationRepository.findOneByOrFail({
      clientId: authorized.clientId,
    })
    stored.status = APP_INSTALLATION_STATUS_REVOKED
    stored.revokedAt = new Date()
    await repositories.appInstallationRepository.save(stored)
    await expect(
      service.issueToken({
        grant_type: "client_credentials",
        client_id: authorized.clientId,
        client_secret: authorized.clientSecret,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("revokes an installation without dropping its credentials or issued JWT", async () => {
    const repositories = setup.getAllRepositories()
    const { project, user } = await createOrganizationWithProject(repositories)
    await assignPlatformStaffToUser({ repositories, user })
    const created = await service.createAppManifest({
      ...createPayload,
      slug: "revoke-assistant",
    })
    const authorized = await service.authorizeInstall({
      slug: created.slug,
      userId: user.id,
      projectId: project.id,
      permissions: [DOCUMENT_READ_PERMISSION],
      redirectUri: "http://127.0.0.1:8787/callback",
      state: "csrf-state",
    })
    const issued = await service.issueToken({
      grant_type: "client_credentials",
      client_id: authorized.clientId,
      client_secret: authorized.clientSecret,
    })
    const installation = await repositories.appInstallationRepository.findOneByOrFail({
      clientId: authorized.clientId,
    })
    const serviceUserId = installation.serviceUserId
    const customRoleId = installation.customRoleId

    await expect(service.listActiveInstallations(project.id)).resolves.toEqual([
      expect.objectContaining({
        id: installation.id,
        appName: "Helpful Assistant",
        description: "A generic assistant used in tests.",
        logoUrl: null,
        permissions: [DOCUMENT_READ_PERMISSION],
        clientId: authorized.clientId,
      }),
    ])

    await service.revokeInstallation({ installationId: installation.id, userId: user.id })
    await expect(service.listActiveInstallations(project.id)).resolves.toEqual([])

    const revoked = await repositories.appInstallationRepository.findOneByOrFail({
      id: installation.id,
    })
    expect(revoked.status).toBe(APP_INSTALLATION_STATUS_REVOKED)
    expect(revoked.revokedAt).toBeInstanceOf(Date)
    expect(revoked.clientId).toBe(authorized.clientId)
    expect(revoked.clientSecretHash).toBe(installation.clientSecretHash)
    expect(revoked.serviceUserId).toBe(serviceUserId)
    expect(revoked.customRoleId).toBe(customRoleId)
    expect(revoked.deletedAt).toBeNull()

    const revokedAt = revoked.revokedAt
    await service.revokeInstallation({ installationId: installation.id, userId: user.id })
    const again = await repositories.appInstallationRepository.findOneByOrFail({
      id: installation.id,
    })
    expect(again.revokedAt?.toISOString()).toBe(revokedAt?.toISOString())

    await expect(
      service.issueToken({
        grant_type: "client_credentials",
        client_id: authorized.clientId,
        client_secret: authorized.clientSecret,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    const principal = await service.resolveAppPrincipal(issued.accessToken)
    expect(principal.installationId).toBe(installation.id)
    expect(principal.projectId).toBe(project.id)

    await expect(
      service.revokeInstallation({ installationId: randomUUID(), userId: user.id }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})
