import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { AppAccessTokenService } from "@/domains/apps/app-access-token.service"
import { AppInstallationRepository } from "@/domains/apps/app-installation.repository"
import { AppManifestRepository } from "@/domains/apps/app-manifest.repository"
import { AppsService } from "@/domains/apps/apps.service"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { ProjectRepository } from "@/domains/projects/project.repository"
import { DOCUMENT_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UserRepository } from "@/domains/users/user.repository"
import { UsersService } from "@/domains/users/users.service"
import { ensureRbacCatalog } from "../../../test/rbac-test.helpers"
import { ClientMetadataDocumentFetcher } from "./client-metadata-document.fetcher"
import { OAuthClientRepository } from "./oauth-client.repository"
import { OAuthClientsService } from "./oauth-clients.service"

describe("OAuthClientsService - app clients", () => {
  let service: OAuthClientsService
  let appsService: AppsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      providers: [
        OAuthClientsService,
        OAuthClientRepository,
        ClientMetadataDocumentFetcher,
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
    service = setup.module.get(OAuthClientsService)
    appsService = setup.module.get(AppsService)
  })

  const createManifest = () =>
    appsService.createAppManifest({
      name: "Helpful Assistant",
      slug: "helpful-assistant",
      description: null,
      logoUrl: null,
      grantablePermissions: [DOCUMENT_READ_PERMISSION],
      allowedRedirectUris: ["https://helpful-assistant.example.org/callback"],
    })

  it("creates the client of an app with the secret it is given", async () => {
    const manifest = await createManifest()

    const client = await service.setAppClientSecret(manifest.id, "a-secret-the-app-holds")

    expect(client.clientId).toMatch(/^app_[0-9a-f]{32}$/)
    expect(client.clientSecret).toBe("a-secret-the-app-holds")
    await expect(
      service.verifyAppClientSecret(client.clientId, "a-secret-the-app-holds"),
    ).resolves.toBe(true)
  })

  it("keeps the client id and replaces the secret", async () => {
    const manifest = await createManifest()
    const first = await service.createAppClientSecret(manifest.id)

    const second = await service.setAppClientSecret(manifest.id, "another-secret")

    expect(second.clientId).toBe(first.clientId)
    await expect(service.verifyAppClientSecret(first.clientId, first.clientSecret)).resolves.toBe(
      false,
    )
    await expect(service.verifyAppClientSecret(first.clientId, "another-secret")).resolves.toBe(
      true,
    )
  })
})
