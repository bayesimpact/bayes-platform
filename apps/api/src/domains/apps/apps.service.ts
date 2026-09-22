import { randomUUID } from "node:crypto"
import {
  type AppGrantablePermission,
  InvalidLoopbackRedirectUriError,
  parseLoopbackRedirectUri,
} from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
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
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UsersService } from "@/domains/users/users.service"
import { buildAppInstallRoleKey } from "./app-install-role"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppInstallationRepository } from "./app-installation.repository"
import type {
  AppManifestRecord,
  CreateAppManifestFields,
  UpdateAppManifestFields,
} from "./app-manifest.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppManifestRepository } from "./app-manifest.repository"
import { generateClientId, generateClientSecret, hashClientSecret } from "./client-credentials"

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

@Injectable()
export class AppsService {
  constructor(
    private readonly appManifestRepository: AppManifestRepository,
    private readonly appInstallationRepository: AppInstallationRepository,
    private readonly roleRepository: RoleRepository,
    private readonly permissionService: PermissionService,
    private readonly usersService: UsersService,
    private readonly projectRepository: ProjectRepository,
    private readonly transactionService: TransactionService,
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
