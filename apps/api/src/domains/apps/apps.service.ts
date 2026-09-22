import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { intersectWithAppGrantablePermissions } from "@/domains/rbac/rbac.constants"
import type {
  AppManifestRecord,
  CreateAppManifestFields,
  UpdateAppManifestFields,
} from "./app-manifest.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppManifestRepository } from "./app-manifest.repository"

@Injectable()
export class AppsService {
  constructor(private readonly appManifestRepository: AppManifestRepository) {}

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

  private requireGrantablePermissions(permissions: readonly string[]): string[] {
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
