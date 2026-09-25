import { randomUUID } from "node:crypto"
import {
  type AppGrantablePermission,
  appClientCredentialsTokenSchema,
  InvalidLoopbackRedirectUriError,
  parseLoopbackRedirectUri,
} from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  BACKOFFICE_PROJECT_READ_PERMISSION,
  intersectWithAppGrantablePermissions,
} from "@/domains/rbac/rbac.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { RoleRepository } from "@/domains/rbac/role.repository"
import { isServiceUser } from "@/domains/users/service-user.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UsersService } from "@/domains/users/users.service"
import { buildAppInstallRoleKey } from "./app-install-role"
import { APP_INSTALLATION_STATUS_REVOKED } from "./app-installation.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import {
  type ActiveAppInstallationSummary,
  AppInstallationRepository,
  type ListedAppInstallation,
} from "./app-installation.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppJwtService } from "./app-jwt.service"
import type {
  AppManifestRecord,
  CreateAppManifestFields,
  UpdateAppManifestFields,
} from "./app-manifest.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppManifestRepository } from "./app-manifest.repository"
import {
  generateClientId,
  generateClientSecret,
  hashClientSecret,
  verifyClientSecret,
} from "./client-credentials"

const INVALID_CLIENT_MESSAGE = "Invalid client credentials"
let dummyClientSecretHash: Promise<string> | undefined

export type AppInstallPage = {
  app: AppManifestRecord
  projects: {
    id: string
    name: string
    organizationId: string
    organizationName: string
  }[]
}

export type AuthorizeAppInstallResult = {
  clientId: string
  clientSecret: string
  redirectUri: string
  state: string
}

export type AppAccessTokenResult = {
  accessToken: string
  tokenType: "Bearer"
  expiresIn: number
}

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
    private readonly permissionService: PermissionService,
    private readonly usersService: UsersService,
    private readonly projectRepository: ProjectRepository,
    private readonly transactionService: TransactionService,
    private readonly appJwtService: AppJwtService,
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
    return this.appManifestRepository.createManifest({ ...fields, grantablePermissions })
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

  async getInstallPage(params: { slug: string; userId: string }): Promise<AppInstallPage> {
    const app = await this.requireManifestBySlug(params.slug)
    const projectIds = await this.permissionService.listResourceIds(
      params.userId,
      BACKOFFICE_PROJECT_READ_PERMISSION,
    )
    const projects = await this.projectRepository.findPickerProjectsByIds(projectIds)
    return { app, projects }
  }

  async authorizeInstall(params: {
    slug: string
    userId: string
    projectId: string
    permissions: readonly string[]
    redirectUri: string
    state: string
  }): Promise<AuthorizeAppInstallResult> {
    const redirectUri = this.requireLoopbackRedirectUri(params.redirectUri)
    const app = await this.requireManifestBySlug(params.slug)
    const selectedPermissions = this.requireInstallPermissions(
      params.permissions,
      app.grantablePermissions,
    )
    const pickerProject = await this.requirePickerProject(params.userId, params.projectId)

    const existing = await this.appInstallationRepository.findActiveByManifestAndProject(
      app.id,
      pickerProject.id,
    )
    if (existing) {
      throw new ConflictException("This app is already installed on that project")
    }

    const clientSecret = generateClientSecret()
    const clientId = generateClientId()
    const clientSecretHash = await hashClientSecret(clientSecret)
    const installationId = randomUUID()

    await this.transactionService.run(async () => {
      const customRole = await this.roleRepository.createProjectRole({
        key: buildAppInstallRoleKey(installationId),
        name: `App install ${app.slug}`,
        permissionKeys: selectedPermissions,
      })
      const serviceUser = await this.usersService.createServiceUser({
        appSlug: app.slug,
        installationId,
      })
      await this.usersService.attachServiceUserMemberships({
        userId: serviceUser.id,
        organizationId: pickerProject.organizationId,
        projectId: pickerProject.id,
        customRoleId: customRole.id,
      })
      await this.appInstallationRepository.createInstallation({
        id: installationId,
        appManifestId: app.id,
        projectId: pickerProject.id,
        serviceUserId: serviceUser.id,
        customRoleId: customRole.id,
        clientId,
        clientSecretHash,
        createdByUserId: params.userId,
      })
    })

    return {
      clientId,
      clientSecret,
      redirectUri,
      state: params.state,
    }
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
    return installations.map((installation) =>
      toActiveInstallationSummary(installation, permissionsByRoleId),
    )
  }

  async revokeInstallation(params: { installationId: string; userId: string }): Promise<void> {
    const installation = await this.appInstallationRepository.findById(params.installationId)
    if (!installation) {
      throw new NotFoundException(`App installation ${params.installationId} not found`)
    }

    const [project] = await this.projectRepository.findPickerProjectsByIds([installation.projectId])
    if (!project) {
      throw new NotFoundException(`Project ${installation.projectId} not found`)
    }

    if (installation.status === APP_INSTALLATION_STATUS_REVOKED) return

    const revokedAt = new Date()
    const revoked = await this.appInstallationRepository.markRevoked(installation.id, revokedAt)
    if (!revoked) return

    this.logger.log(
      `Revoked app installation ${installation.id} on project ${project.id} by user ${params.userId}`,
    )
  }

  async issueToken(body: unknown): Promise<AppAccessTokenResult> {
    const parsed = parseClientCredentialsBody(body)
    const installation = await this.appInstallationRepository.findActiveByClientId(parsed.client_id)
    const storedHash = installation?.clientSecretHash ?? (await dummySecretHash())
    const secretMatches = await verifyClientSecret(parsed.client_secret, storedHash)
    if (
      !installation ||
      !installation.serviceUserId ||
      !installation.clientSecretHash ||
      !secretMatches
    ) {
      throw new UnauthorizedException(INVALID_CLIENT_MESSAGE)
    }

    const accessToken = this.appJwtService.sign({
      subject: installation.serviceUserId,
      projectId: installation.projectId,
      installationId: installation.id,
    })
    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.appJwtService.ttlSeconds,
    }
  }

  async resolveAppPrincipal(token: string): Promise<AppPrincipal> {
    const claims = this.appJwtService.verify(token)
    // Revocation stops new tokens only. An issued JWT stays valid until exp.
    const installation = await this.appInstallationRepository.findById(claims.installation_id)
    if (!installation || installation.projectId !== claims.project_id) {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_ACCESS_TOKEN)
    }

    const user = await this.usersService.findById(claims.sub)
    if (!user || !isServiceUser(user) || installation.serviceUserId !== user.id) {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_ACCESS_TOKEN)
    }

    return {
      user,
      projectId: installation.projectId,
      installationId: installation.id,
    }
  }

  private requireLoopbackRedirectUri(raw: string): string {
    try {
      parseLoopbackRedirectUri(raw)
      return raw
    } catch (error) {
      if (error instanceof InvalidLoopbackRedirectUriError) {
        throw new BadRequestException(error.message)
      }
      throw error
    }
  }

  private async requireManifestBySlug(slug: string): Promise<AppManifestRecord> {
    const manifest = await this.appManifestRepository.findBySlug(slug)
    if (!manifest) throw new NotFoundException(`App ${slug} not found`)
    return manifest
  }

  private async requirePickerProject(
    userId: string,
    projectId: string,
  ): Promise<{ id: string; organizationId: string }> {
    const projectIds = await this.permissionService.listResourceIds(
      userId,
      BACKOFFICE_PROJECT_READ_PERMISSION,
    )
    if (!projectIds.includes(projectId)) {
      throw new ForbiddenException("Project is not available for app installation")
    }
    const [project] = await this.projectRepository.findPickerProjectsByIds([projectId])
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`)
    }
    return project
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

function parseClientCredentialsBody(body: unknown): {
  grant_type: "client_credentials"
  client_id: string
  client_secret: string
} {
  const parsed = appClientCredentialsTokenSchema.safeParse(body)
  if (!parsed.success) {
    throw new UnauthorizedException(INVALID_CLIENT_MESSAGE)
  }
  return parsed.data
}

function dummySecretHash(): Promise<string> {
  dummyClientSecretHash ??= hashClientSecret("timing-safe-dummy")
  return dummyClientSecretHash
}

function toActiveInstallationSummary(
  installation: ListedAppInstallation,
  permissionsByRoleId: Map<string, string[]>,
): ActiveAppInstallationSummary {
  return {
    id: installation.id,
    appName: installation.appName,
    description: installation.description,
    logoUrl: installation.logoUrl,
    permissions: installation.customRoleId
      ? (permissionsByRoleId.get(installation.customRoleId) ?? [])
      : [],
    clientId: installation.clientId,
    createdAt: installation.createdAt,
  }
}
