import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import {
  APP_INSTALLATION_STATUS_ACTIVE,
  APP_INSTALLATION_STATUS_REVOKED,
  AppInstallation,
  type AppInstallationStatus,
} from "./app-installation.entity"

export type AppInstallationRecord = {
  id: string
  appManifestId: string
  projectId: string
  serviceUserId: string | null
  customRoleId: string | null
  clientId: string | null
  clientSecretHash: string | null
  status: AppInstallationStatus
  createdByUserId: string | null
  revokedAt: Date | null
}

export type ListedAppInstallation = {
  id: string
  appName: string
  description: string | null
  logoUrl: string | null
  customRoleId: string | null
  createdAt: Date
}

export type ActiveAppInstallationSummary = {
  id: string
  appName: string
  description: string | null
  logoUrl: string | null
  permissions: string[]
  createdAt: Date
}

export type CreateAppInstallationFields = {
  id: string
  appManifestId: string
  projectId: string
  serviceUserId: string
  customRoleId: string
  clientId: string
  clientSecretHash: string
  createdByUserId: string
}

@Injectable()
export class AppInstallationRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findActiveByManifestAndProject(
    appManifestId: string,
    projectId: string,
  ): Promise<AppInstallationRecord | null> {
    const installation = await this.repo().findOne({
      where: { appManifestId, projectId, status: APP_INSTALLATION_STATUS_ACTIVE },
    })
    return installation ? this.toRecord(installation) : null
  }

  async findActiveByClientId(clientId: string): Promise<AppInstallationRecord | null> {
    const installation = await this.repo().findOne({
      where: { clientId, status: APP_INSTALLATION_STATUS_ACTIVE },
    })
    return installation ? this.toRecord(installation) : null
  }

  async listActiveByProjectId(projectId: string): Promise<ListedAppInstallation[]> {
    const installations = await this.repo().find({
      where: { projectId, status: APP_INSTALLATION_STATUS_ACTIVE },
      relations: { appManifest: true },
      order: { createdAt: "DESC" },
    })
    return installations.map((installation) => ({
      id: installation.id,
      appName: installation.appManifest?.name ?? "App",
      description: installation.appManifest?.description ?? null,
      logoUrl: installation.appManifest?.logoUrl ?? null,
      customRoleId: installation.customRoleId,
      createdAt: installation.createdAt,
    }))
  }

  async findById(installationId: string): Promise<AppInstallationRecord | null> {
    const installation = await this.repo().findOne({ where: { id: installationId } })
    return installation ? this.toRecord(installation) : null
  }

  /** Sets `status` and `revoked_at` only. Leaves credentials, the service user, and the role in place. */
  async markRevoked(
    installationId: string,
    revokedAt: Date,
  ): Promise<AppInstallationRecord | null> {
    const installation = await this.repo().findOne({
      where: { id: installationId, status: APP_INSTALLATION_STATUS_ACTIVE },
    })
    if (!installation) return null
    installation.status = APP_INSTALLATION_STATUS_REVOKED
    installation.revokedAt = revokedAt
    const saved = await this.repo().save(installation)
    return this.toRecord(saved)
  }

  async createInstallation(fields: CreateAppInstallationFields): Promise<AppInstallationRecord> {
    const saved = await this.repo().save(
      this.repo().create({
        ...fields,
        status: APP_INSTALLATION_STATUS_ACTIVE,
        revokedAt: null,
      }),
    )
    return this.toRecord(saved)
  }

  private toRecord(installation: AppInstallation): AppInstallationRecord {
    return {
      id: installation.id,
      appManifestId: installation.appManifestId,
      projectId: installation.projectId,
      serviceUserId: installation.serviceUserId,
      customRoleId: installation.customRoleId,
      clientId: installation.clientId,
      clientSecretHash: installation.clientSecretHash,
      status: installation.status,
      createdByUserId: installation.createdByUserId,
      revokedAt: installation.revokedAt,
    }
  }

  private repo(): Repository<AppInstallation> {
    return this.transactionService.getManager().getRepository(AppInstallation)
  }
}
