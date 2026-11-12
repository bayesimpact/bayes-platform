import { randomUUID } from "node:crypto"
import {
  type AppGrantablePermission,
  type AppInstallerDto,
  MAX_ALLOWED_REDIRECT_URIS,
} from "@caseai-connect/api-contracts"
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "@/domains/projects/project.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import {
  intersectWithAppGrantablePermissions,
  PROJECT_APP_INSTALLATION_CREATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { RoleRepository } from "@/domains/rbac/role.repository"
import { isServiceUser } from "@/domains/users/service-user.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UsersService } from "@/domains/users/users.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppAccessTokenService } from "./app-access-token.service"
import { buildAppInstallRoleKey } from "./app-install-role"
import {
  APP_INSTALLATION_STATUS_ACTIVE,
  APP_INSTALLATION_STATUS_REVOKED,
} from "./app-installation.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import {
  type ActiveAppInstallationSummary,
  type AppInstallationInstaller,
  AppInstallationRepository,
  type ListedAppInstallation,
  type ResolvedAppInstaller,
} from "./app-installation.repository"
import { toAppInstallerDto } from "./app-installer"
import type {
  AppManifestRecord,
  CreateAppManifestFields,
  UpdateAppManifestFields,
} from "./app-manifest.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppManifestRepository } from "./app-manifest.repository"

export type InstalledApp = {
  installationId: string
  serviceUserId: string
  organizationId: string
  projectId: string
  /** The app was already installed on the project: same installation, new permissions. */
  reconnected: boolean
}

export type AppCatalogEntry = AppManifestRecord & { installed: boolean }

export type AppPrincipal = {
  user: NonNullable<Awaited<ReturnType<UsersService["findById"]>>>
  projectId: string
  installationId: string
}

@Injectable()
export class AppsService {
  private readonly logger = new Logger(AppsService.name)

  constructor(
    private readonly appManifestRepository: AppManifestRepository,
    private readonly appInstallationRepository: AppInstallationRepository,
    private readonly roleRepository: RoleRepository,
    private readonly usersService: UsersService,
    private readonly projectRepository: ProjectRepository,
    private readonly transactionService: TransactionService,
    private readonly appAccessTokenService: AppAccessTokenService,
    private readonly permissionService: PermissionService,
  ) {}

  listAppManifests(): Promise<AppManifestRecord[]> {
    return this.appManifestRepository.findAll()
  }

  async getAppManifest(appManifestId: string): Promise<AppManifestRecord> {
    const manifest = await this.appManifestRepository.findById(appManifestId)
    if (!manifest) throw new NotFoundException(`App ${appManifestId} not found`)
    return manifest
  }

  async createAppManifest(fields: CreateAppManifestFields): Promise<AppManifestRecord> {
    const grantablePermissions = this.requireGrantablePermissions(fields.grantablePermissions)
    await this.assertSlugAvailable(fields.slug)
    return this.appManifestRepository.createManifest({
      ...fields,
      grantablePermissions,
      allowedRedirectUris: fields.allowedRedirectUris ?? [],
    })
  }

  async updateAppManifest(
    appManifestId: string,
    fields: UpdateAppManifestFields,
  ): Promise<AppManifestRecord> {
    await this.getAppManifest(appManifestId)
    const grantablePermissions =
      fields.grantablePermissions === undefined
        ? undefined
        : this.requireGrantablePermissions(fields.grantablePermissions)
    if (fields.slug !== undefined) {
      await this.assertSlugAvailable(fields.slug, appManifestId)
    }
    const updated = await this.appManifestRepository.updateManifest(appManifestId, {
      ...fields,
      ...(grantablePermissions === undefined ? {} : { grantablePermissions }),
    })
    if (!updated) throw new NotFoundException(`App ${appManifestId} not found`)
    return updated
  }

  /**
   * Registers an app by slug, for scripts and dev tooling: creates its manifest, or adds the given
   * redirect URIs and permissions to the ones it has. Its name and description stay as they are
   * when it exists. The allowlist keeps its most recent MAX_ALLOWED_REDIRECT_URIS entries.
   */
  async registerAppManifest(
    fields: CreateAppManifestFields & { allowedRedirectUris: string[] },
  ): Promise<AppManifestRecord> {
    const existing = await this.appManifestRepository.findBySlug(fields.slug)
    if (!existing) return this.createAppManifest(fields)
    const allowedRedirectUris = [
      ...new Set([
        ...existing.allowedRedirectUris.filter((uri) => !fields.allowedRedirectUris.includes(uri)),
        ...fields.allowedRedirectUris,
      ]),
    ].slice(-MAX_ALLOWED_REDIRECT_URIS)
    const grantablePermissions = [
      ...new Set([...existing.grantablePermissions, ...fields.grantablePermissions]),
    ]
    return this.updateAppManifest(existing.id, { allowedRedirectUris, grantablePermissions })
  }

  async deleteAppManifest(appManifestId: string): Promise<void> {
    await this.getAppManifest(appManifestId)
    const activeInstallations =
      await this.appManifestRepository.countActiveInstallations(appManifestId)
    if (activeInstallations > 0) {
      throw new ConflictException("Cannot delete an app that still has active installations")
    }
    const deleted = await this.appManifestRepository.softDeleteById(appManifestId)
    if (!deleted) throw new NotFoundException(`App ${appManifestId} not found`)
  }

  async describeInstalledProject(projectId: string): Promise<{
    id: string
    name: string
    organizationId: string
    organizationName: string
  }> {
    const [project] = await this.projectRepository.findPickerProjectsByIds([projectId])
    if (!project) throw new NotFoundException(`Project ${projectId} not found`)
    return project
  }

  /**
   * Installs an app approved on the consent page of the OAuth server
   * (ADR 0029): the service user, its role and memberships, and the
   * installation. An app already installed on the project is reconnected
   * instead: it keeps its installation, so its service user, conversations
   * and document sources, and its role gets the permissions just granted.
   * Only its installer reconnects it, as long as they can still install apps
   * on the project. Once they cannot, whoever approves takes the installation
   * over and becomes its installer.
   * The caller checked who approves and what they can grant, and runs this
   * in the transaction that also creates the grant.
   */
  async installApprovedApp(params: {
    appManifestId: string
    projectId: string
    permissions: readonly string[]
    userId: string
  }): Promise<InstalledApp> {
    const app = await this.getAppManifest(params.appManifestId)
    const permissions = this.requireInstallPermissions(params.permissions, app.grantablePermissions)
    const [project] = await this.projectRepository.findPickerProjectsByIds([params.projectId])
    if (!project) throw new NotFoundException(`Project ${params.projectId} not found`)

    return this.transactionService.run(async () => {
      const existing = await this.appInstallationRepository.findActiveByManifestAndProject(
        app.id,
        project.id,
      )
      // Reconnecting replaces the permissions and ends the app's tokens. While who installed the
      // app can still do that, nobody else may, so no one overwrites a colleague's installation
      // without knowing it.
      const isTakeover = !!existing && existing.createdByUserId !== params.userId
      if (isTakeover) {
        const installers = await this.listResolvedInstallers(app.id, [project.id])
        if (installers.get(project.id)?.canStillInstall) {
          throw new ConflictException(
            "This app is already installed on that project by someone else. Ask them to reconnect it, or revoke it and install it again.",
          )
        }
      }
      if (existing?.serviceUserId && existing.customRoleId) {
        await this.roleRepository.replacePermissionKeys(existing.customRoleId, permissions)
        if (isTakeover) {
          await this.appInstallationRepository.setCreatedByUserId(existing.id, params.userId)
        }
        this.logger.log(
          `Reconnected app installation ${existing.id} by user ${params.userId}${isTakeover ? `, taken over from ${existing.createdByUserId ?? "nobody"}` : ""}`,
        )
        return {
          installationId: existing.id,
          serviceUserId: existing.serviceUserId,
          organizationId: project.organizationId,
          projectId: project.id,
          reconnected: true,
        }
      }
      if (existing) {
        throw new ConflictException("This app is already installed on that project")
      }
      const installationId = randomUUID()
      const customRole = await this.roleRepository.createProjectRole({
        key: buildAppInstallRoleKey(installationId),
        name: `App install ${app.slug}`,
        permissionKeys: permissions,
      })
      const serviceUser = await this.usersService.createServiceUser({
        appSlug: app.slug,
        installationId,
      })
      await this.usersService.attachServiceRoleGrants({
        userId: serviceUser.id,
        organizationId: project.organizationId,
        projectId: project.id,
        customRoleId: customRole.id,
      })
      await this.appInstallationRepository.createInstallation({
        id: installationId,
        appManifestId: app.id,
        projectId: project.id,
        serviceUserId: serviceUser.id,
        customRoleId: customRole.id,
        createdByUserId: params.userId,
      })
      return {
        installationId,
        serviceUserId: serviceUser.id,
        organizationId: project.organizationId,
        projectId: project.id,
        reconnected: false,
      }
    })
  }

  /** The apps listed in the catalog, each marked when the project has it installed. */
  async listAppCatalog(projectId: string): Promise<AppCatalogEntry[]> {
    const [manifests, installedManifestIds] = await Promise.all([
      this.appManifestRepository.findListedInCatalog(),
      this.appInstallationRepository.listActiveManifestIdsByProjectId(projectId),
    ])
    const installed = new Set(installedManifestIds)
    return manifests.map((manifest) => ({ ...manifest, installed: installed.has(manifest.id) }))
  }

  isAppsCatalogEnabled(projectId: string): Promise<boolean> {
    return this.projectRepository.isFeatureEnabled({ projectId, feature: "apps-catalog" })
  }

  /** Who installed the app on each of these projects where it is active, by project id. */
  async describeInstallers(params: {
    appManifestId: string
    projectIds: string[]
    viewerUserId: string
  }): Promise<Map<string, AppInstallerDto>> {
    const installers = await this.listResolvedInstallers(params.appManifestId, params.projectIds)
    return new Map(
      [...installers].map(([projectId, installer]) => [
        projectId,
        toAppInstallerDto(installer, params.viewerUserId),
      ]),
    )
  }

  async listActiveInstallations(projectId: string): Promise<ActiveAppInstallationSummary[]> {
    const [project] = await this.projectRepository.findPickerProjectsByIds([projectId])
    if (!project) throw new NotFoundException(`Project ${projectId} not found`)
    const installations = await this.appInstallationRepository.listActiveByProjectId(project.id)
    const permissionsByRoleId = await this.roleRepository.listPermissionKeysByRoleIds(
      installations.flatMap((installation) =>
        installation.customRoleId ? [installation.customRoleId] : [],
      ),
    )
    return Promise.all(
      installations.map(async (installation) =>
        toActiveInstallationSummary(
          installation,
          permissionsByRoleId,
          await this.resolveInstaller(installation.installer, project.id),
        ),
      ),
    )
  }

  private async listResolvedInstallers(
    appManifestId: string,
    projectIds: string[],
  ): Promise<Map<string, ResolvedAppInstaller>> {
    const installers = await this.appInstallationRepository.listActiveInstallersByProjectId(
      appManifestId,
      projectIds,
    )
    return new Map(
      await Promise.all(
        [...installers].map(
          async ([projectId, installer]) =>
            [projectId, await this.resolveInstaller(installer, projectId)] as const,
        ),
      ),
    )
  }

  /**
   * Whether the installer can still install apps on the project, asked to the RBAC like the
   * approval itself. False for a missing or deleted user, someone removed from the project, and
   * someone who lost the permission.
   */
  private async resolveInstaller(
    installer: AppInstallationInstaller,
    projectId: string,
  ): Promise<ResolvedAppInstaller> {
    const canStillInstall =
      !!installer.createdByUserId &&
      !!installer.user &&
      (await this.permissionService.has(
        installer.createdByUserId,
        PROJECT_APP_INSTALLATION_CREATE_PERMISSION,
        { type: "project", id: projectId },
      ))
    return { ...installer, canStillInstall }
  }

  /** The service user an installation acts as, null once it is revoked. */
  async findActiveServiceUserId(installationId: string): Promise<string | null> {
    const installation = await this.appInstallationRepository.findById(installationId)
    return installation?.status === APP_INSTALLATION_STATUS_ACTIVE
      ? installation.serviceUserId
      : null
  }

  /** With `projectId`, an installation of another project is reported as missing. */
  async revokeInstallation(params: {
    installationId: string
    /** Null when the app revokes itself through the OAuth server. */
    userId: string | null
    projectId?: string
  }): Promise<{ organizationId: string; projectId: string }> {
    const installation = await this.appInstallationRepository.findById(params.installationId)
    if (!installation || (params.projectId && installation.projectId !== params.projectId)) {
      throw new NotFoundException(`App installation ${params.installationId} not found`)
    }

    const [project] = await this.projectRepository.findPickerProjectsByIds([installation.projectId])
    if (!project) {
      throw new NotFoundException(`Project ${installation.projectId} not found`)
    }

    const scope = { organizationId: project.organizationId, projectId: project.id }
    if (installation.status === APP_INSTALLATION_STATUS_REVOKED) return scope

    const revoked = await this.appInstallationRepository.markRevoked(installation.id, new Date())
    if (!revoked) return scope

    this.logger.log(
      `Revoked app installation ${installation.id} on project ${project.id} by ${params.userId ? `user ${params.userId}` : "its app"}`,
    )
    return scope
  }

  /**
   * The installation behind an access token of the apps API, issued by the
   * authorization server (ADR 0029). The installation and the token's grant
   * are loaded every time: once either is revoked, the token stops at once.
   */
  async resolveAppPrincipal(
    token: string,
    urls: { issuer: string; appsResource: string },
  ): Promise<AppPrincipal> {
    const claims = this.appAccessTokenService.verify(token, urls)
    const installation = await this.appInstallationRepository.findById(claims.installationId)
    if (
      !installation ||
      installation.status !== APP_INSTALLATION_STATUS_ACTIVE ||
      !(await this.appInstallationRepository.hasActiveGrant(installation.id, claims.grantId))
    ) {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_ACCESS_TOKEN)
    }

    const user = await this.usersService.findById(claims.serviceUserId)
    if (!user || !isServiceUser(user) || installation.serviceUserId !== user.id) {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_ACCESS_TOKEN)
    }

    return {
      user,
      projectId: installation.projectId,
      installationId: installation.id,
    }
  }

  private requireInstallPermissions(
    requested: readonly string[],
    manifestGrantable: readonly string[],
  ): AppGrantablePermission[] {
    const granted = this.requireGrantablePermissions(requested)
    const manifestSet = new Set(manifestGrantable)
    if (granted.some((permission) => !manifestSet.has(permission))) {
      throw new UnprocessableEntityException(
        "permissions must be a subset of this app's grantablePermissions",
      )
    }
    return granted
  }

  private requireGrantablePermissions(permissions: readonly string[]): AppGrantablePermission[] {
    const granted = intersectWithAppGrantablePermissions(permissions)
    if (granted.length !== new Set(permissions).size) {
      throw new UnprocessableEntityException(
        "grantablePermissions must be a subset of the server-side App allowlist",
      )
    }
    return granted
  }

  private async assertSlugAvailable(slug: string, exceptId?: string): Promise<void> {
    const existing = await this.appManifestRepository.findBySlug(slug)
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(`An app with slug "${slug}" already exists`)
    }
  }
}

function toActiveInstallationSummary(
  installation: ListedAppInstallation,
  permissionsByRoleId: Map<string, string[]>,
  installer: ResolvedAppInstaller,
): ActiveAppInstallationSummary {
  return {
    id: installation.id,
    appName: installation.appName,
    description: installation.description,
    logoUrl: installation.logoUrl,
    appUrl: installation.appUrl,
    permissions: installation.customRoleId
      ? (permissionsByRoleId.get(installation.customRoleId) ?? [])
      : [],
    createdAt: installation.createdAt,
    installer,
  }
}
