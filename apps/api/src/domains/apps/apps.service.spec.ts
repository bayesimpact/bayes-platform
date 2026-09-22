import { randomUUID } from "node:crypto"
import { ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { DOCUMENT_CREATE_PERMISSION, DOCUMENT_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
import {
  APP_INSTALLATION_STATUS_ACTIVE,
  APP_INSTALLATION_STATUS_REVOKED,
} from "./app-installation.entity"
import { appInstallationFactory } from "./app-installation.factory"
import { AppManifestRepository } from "./app-manifest.repository"
import { AppsService } from "./apps.service"

describe("AppsService", () => {
  let service: AppsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      providers: [AppsService, AppManifestRepository],
    })
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
    await repositories.appInstallationRepository.save(
      appInstallationFactory.build({
        appManifestId: created.id,
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
})
