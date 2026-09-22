import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import {
  APP_INSTALLATION_STATUS_ACTIVE,
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
