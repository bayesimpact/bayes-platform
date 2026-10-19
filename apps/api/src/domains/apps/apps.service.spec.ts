import { randomUUID } from "node:crypto"
import { ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
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
import { ensureRbacCatalog } from "../../../test/rbac-test.helpers"
import { AppAccessTokenService } from "./app-access-token.service"
import {
  APP_INSTALLATION_STATUS_ACTIVE,
  APP_INSTALLATION_STATUS_REVOKED,
} from "./app-installation.entity"
import { appInstallationFactory } from "./app-installation.factory"
import { AppInstallationRepository } from "./app-installation.repository"
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
        AppAccessTokenService,
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

  describe("registerAppManifest", () => {
    it("creates the manifest of an unknown slug", async () => {
      const registered = await service.registerAppManifest({
        ...createPayload,
        allowedRedirectUris: ["https://helpful-assistant.example.org/callback"],
      })

      expect(registered.slug).toBe("helpful-assistant")
      expect(registered.allowedRedirectUris).toEqual([
        "https://helpful-assistant.example.org/callback",
      ])
    })

    it("adds redirect URIs and permissions to an existing manifest, keeping its name", async () => {
      const created = await service.createAppManifest({
        ...createPayload,
        name: "Named in the back-office",
        grantablePermissions: [DOCUMENT_READ_PERMISSION],
        allowedRedirectUris: ["https://first.example.org/callback"],
      })

      const registered = await service.registerAppManifest({
        ...createPayload,
        grantablePermissions: [DOCUMENT_CREATE_PERMISSION],
        allowedRedirectUris: [
          "https://second.example.org/callback",
          "https://first.example.org/callback",
        ],
      })

      expect(registered.id).toBe(created.id)
      expect(registered.name).toBe("Named in the back-office")
      expect(registered.grantablePermissions).toEqual([
        DOCUMENT_READ_PERMISSION,
        DOCUMENT_CREATE_PERMISSION,
      ])
      expect(registered.allowedRedirectUris).toEqual([
        "https://second.example.org/callback",
        "https://first.example.org/callback",
      ])
    })

    it("keeps the most recent redirect URIs within the limit", async () => {
      const older = Array.from({ length: 20 }, (_, index) => `https://old-${index}.example.org/cb`)
      await service.createAppManifest({ ...createPayload, allowedRedirectUris: older })

      const registered = await service.registerAppManifest({
        ...createPayload,
        allowedRedirectUris: ["https://new.example.org/cb"],
      })

      expect(registered.allowedRedirectUris).toHaveLength(20)
      expect(registered.allowedRedirectUris.at(-1)).toBe("https://new.example.org/cb")
      expect(registered.allowedRedirectUris).not.toContain("https://old-0.example.org/cb")
    })
  })

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

  it("installs an approved app as a service user, and reconnects it with new permissions", async () => {
    const repositories = setup.getAllRepositories()
    const { project, user } = await createOrganizationWithProject(repositories)
    const created = await service.createAppManifest(createPayload)

    const installed = await service.installApprovedApp({
      appManifestId: created.id,
      projectId: project.id,
      permissions: [DOCUMENT_READ_PERMISSION],
      userId: user.id,
    })

    expect(installed).toMatchObject({
      organizationId: project.organizationId,
      projectId: project.id,
      reconnected: false,
    })
    const installation = await repositories.appInstallationRepository.findOneByOrFail({
      id: installed.installationId,
    })
    expect(installation).toMatchObject({
      appManifestId: created.id,
      serviceUserId: installed.serviceUserId,
      createdByUserId: user.id,
      status: APP_INSTALLATION_STATUS_ACTIVE,
    })
    const serviceUser = await repositories.userRepository.findOneByOrFail({
      id: installed.serviceUserId,
    })
    expect(serviceUser.type).toBe(USER_TYPE_SERVICE)

    const permissionService = setup.module.get(PermissionService)
    const projectResource = { type: "project" as const, id: project.id }
    await expect(
      permissionService.has(serviceUser.id, DOCUMENT_READ_PERMISSION, projectResource),
    ).resolves.toBe(true)
    await expect(
      permissionService.has(serviceUser.id, DOCUMENT_CREATE_PERMISSION, projectResource),
    ).resolves.toBe(false)
    const catalog = await permissionService.getCatalog()
    expect(catalog.roles.some((role) => role.key.startsWith("app_install_"))).toBe(false)

    const reconnected = await service.installApprovedApp({
      appManifestId: created.id,
      projectId: project.id,
      permissions: [DOCUMENT_CREATE_PERMISSION],
      userId: user.id,
    })
    expect(reconnected).toEqual({ ...installed, reconnected: true })
    await expect(
      permissionService.has(serviceUser.id, DOCUMENT_CREATE_PERMISSION, projectResource),
    ).resolves.toBe(true)
    await expect(
      permissionService.has(serviceUser.id, DOCUMENT_READ_PERMISSION, projectResource),
    ).resolves.toBe(false)
    expect(await repositories.appInstallationRepository.count()).toBe(1)
  })

  it("refuses a permission the app does not offer", async () => {
    const repositories = setup.getAllRepositories()
    const { project, user } = await createOrganizationWithProject(repositories)
    const created = await service.createAppManifest({
      ...createPayload,
      grantablePermissions: [DOCUMENT_READ_PERMISSION],
    })

    await expect(
      service.installApprovedApp({
        appManifestId: created.id,
        projectId: project.id,
        permissions: [DOCUMENT_CREATE_PERMISSION],
        userId: user.id,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException)
  })

  it("revokes an installation once, and reports another project's as missing", async () => {
    const repositories = setup.getAllRepositories()
    const { project, user } = await createOrganizationWithProject(repositories)
    const created = await service.createAppManifest(createPayload)
    const installed = await service.installApprovedApp({
      appManifestId: created.id,
      projectId: project.id,
      permissions: [DOCUMENT_READ_PERMISSION],
      userId: user.id,
    })

    await expect(
      service.revokeInstallation({
        installationId: installed.installationId,
        userId: user.id,
        projectId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.findActiveServiceUserId(installed.installationId)).resolves.toBe(
      installed.serviceUserId,
    )

    const scope = await service.revokeInstallation({
      installationId: installed.installationId,
      userId: user.id,
      projectId: project.id,
    })
    expect(scope).toEqual({ organizationId: project.organizationId, projectId: project.id })
    const revoked = await repositories.appInstallationRepository.findOneByOrFail({
      id: installed.installationId,
    })
    expect(revoked.status).toBe(APP_INSTALLATION_STATUS_REVOKED)
    await expect(service.findActiveServiceUserId(installed.installationId)).resolves.toBeNull()

    await service.revokeInstallation({ installationId: installed.installationId, userId: null })
    const again = await repositories.appInstallationRepository.findOneByOrFail({
      id: installed.installationId,
    })
    expect(again.revokedAt?.toISOString()).toBe(revoked.revokedAt?.toISOString())

    await expect(
      service.revokeInstallation({ installationId: randomUUID(), userId: user.id }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})
