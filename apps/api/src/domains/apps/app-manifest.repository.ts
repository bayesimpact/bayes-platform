import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { APP_INSTALLATION_STATUS_ACTIVE, AppInstallation } from "./app-installation.entity"
import { AppManifest } from "./app-manifest.entity"

export type AppManifestRecord = {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  grantablePermissions: string[]
  createdAt: Date
}

export type CreateAppManifestFields = {
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  grantablePermissions: string[]
}

export type UpdateAppManifestFields = Partial<CreateAppManifestFields>

@Injectable()
export class AppManifestRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findAll(): Promise<AppManifestRecord[]> {
    const manifests = await this.repo().find({ order: { name: "ASC" } })
    return manifests.map((manifest) => this.toRecord(manifest))
  }

  async findById(appManifestId: string): Promise<AppManifestRecord | null> {
    const manifest = await this.repo().findOne({ where: { id: appManifestId } })
    return manifest ? this.toRecord(manifest) : null
  }

  async findBySlug(slug: string): Promise<AppManifestRecord | null> {
    const manifest = await this.repo().findOne({ where: { slug } })
    return manifest ? this.toRecord(manifest) : null
  }

  async createManifest(fields: CreateAppManifestFields): Promise<AppManifestRecord> {
    const saved = await this.repo().save(this.repo().create(fields))
    return this.toRecord(saved)
  }

  async updateManifest(
    appManifestId: string,
    fields: UpdateAppManifestFields,
  ): Promise<AppManifestRecord | null> {
    const manifest = await this.repo().findOne({ where: { id: appManifestId } })
    if (!manifest) return null
    const definedFields = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    )
    Object.assign(manifest, definedFields)
    return this.toRecord(await this.repo().save(manifest))
  }

  async softDeleteById(appManifestId: string): Promise<boolean> {
    const result = await this.repo().softDelete({ id: appManifestId })
    return (result.affected ?? 0) > 0
  }

  async countActiveInstallations(appManifestId: string): Promise<number> {
    return this.installationRepo().count({
      where: { appManifestId, status: APP_INSTALLATION_STATUS_ACTIVE },
    })
  }

  private repo(): Repository<AppManifest> {
    return this.transactionService.getManager().getRepository(AppManifest)
  }

  private installationRepo(): Repository<AppInstallation> {
    return this.transactionService.getManager().getRepository(AppInstallation)
  }

  private toRecord(manifest: AppManifest): AppManifestRecord {
    return {
      id: manifest.id,
      name: manifest.name,
      slug: manifest.slug,
      description: manifest.description,
      logoUrl: manifest.logoUrl,
      grantablePermissions: manifest.grantablePermissions,
      createdAt: manifest.createdAt,
    }
  }
}
