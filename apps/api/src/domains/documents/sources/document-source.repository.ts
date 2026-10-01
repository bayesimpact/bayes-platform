import { ConflictException, Injectable } from "@nestjs/common"
import { QueryFailedError, type Repository } from "typeorm"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { Document } from "@/domains/documents/document.entity"
import { DocumentSource } from "./document-source.entity"

const UNIQUE_VIOLATION = "23505"
const FOREIGN_KEY_VIOLATION = "23503"

export type CreateDocumentSourceFields = {
  name: string
  type: string | null
  externalId: string | null
  baseUrl: string | null
  config: Record<string, unknown> | null
  appInstallationId?: string | null
}

export type UpdateDocumentSourceFields = {
  name?: string
  config?: Record<string, unknown> | null
}

export type DocumentSourceAppRecord = {
  name: string
  logoUrl: string | null
}

export type DocumentSourceWithApp = {
  documentSource: DocumentSource
  app: DocumentSourceAppRecord | null
}

export type DocumentSourceStats = {
  documentSourceId: string
  documentCount: number
  indexedDocumentCount: number
  failedDocumentCount: number
  lastSyncedAt: Date | null
}

@Injectable()
export class DocumentSourceRepository {
  constructor(private readonly transactionService: TransactionService) {}

  list(
    connectScope: RequiredConnectScope,
    filters?: { externalId?: string },
  ): Promise<DocumentSource[]> {
    return this.repo().find({
      where: {
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
        ...(filters?.externalId ? { externalId: filters.externalId } : {}),
      },
      order: { createdAt: "ASC" },
    })
  }

  async listStats(connectScope: RequiredConnectScope): Promise<DocumentSourceStats[]> {
    const rows: DocumentSourceStatsRow[] = await this.transactionService
      .getManager()
      .getRepository(Document)
      .createQueryBuilder("document")
      .select("document.documentSourceId", "documentSourceId")
      .addSelect("COUNT(*)::int", "documentCount")
      .addSelect(
        "COUNT(*) FILTER (WHERE document.embedding_status = 'completed')::int",
        "indexedDocumentCount",
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE document.embedding_status = 'failed')::int",
        "failedDocumentCount",
      )
      .addSelect("MAX(document.created_at)", "lastSyncedAt")
      .where("document.organizationId = :organizationId", {
        organizationId: connectScope.organizationId,
      })
      .andWhere("document.projectId = :projectId", { projectId: connectScope.projectId })
      .andWhere("document.documentSourceId IS NOT NULL")
      .groupBy("document.documentSourceId")
      .getRawMany()

    return rows.map((row) => ({
      documentSourceId: row.documentSourceId,
      documentCount: Number(row.documentCount),
      indexedDocumentCount: Number(row.indexedDocumentCount),
      failedDocumentCount: Number(row.failedDocumentCount),
      lastSyncedAt: toDate(row.lastSyncedAt),
    }))
  }

  async listWithApp(connectScope: RequiredConnectScope): Promise<DocumentSourceWithApp[]> {
    const { entities, raw } = await this.repo()
      .createQueryBuilder("documentSource")
      .leftJoin("documentSource.appInstallation", "installation")
      .leftJoin("installation.appManifest", "manifest")
      .addSelect("manifest.name", "appName")
      .addSelect("manifest.logoUrl", "appLogoUrl")
      .where("documentSource.organizationId = :organizationId", {
        organizationId: connectScope.organizationId,
      })
      .andWhere("documentSource.projectId = :projectId", { projectId: connectScope.projectId })
      .orderBy("documentSource.createdAt", "ASC")
      .getRawAndEntities()

    return entities.map((documentSource, index) => {
      const row = raw[index] as { appName?: string | null; appLogoUrl?: string | null } | undefined
      const name = row?.appName
      return {
        documentSource,
        app: name ? { name, logoUrl: row?.appLogoUrl ?? null } : null,
      }
    })
  }

  findOne(connectScope: RequiredConnectScope, id: string): Promise<DocumentSource | null> {
    return this.repo().findOne({
      where: {
        id,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
    })
  }

  async createOne(
    connectScope: RequiredConnectScope,
    fields: CreateDocumentSourceFields,
  ): Promise<DocumentSource> {
    try {
      return await this.repo().save(
        this.repo().create({
          organizationId: connectScope.organizationId,
          projectId: connectScope.projectId,
          name: fields.name,
          type: fields.type,
          externalId: fields.externalId,
          baseUrl: fields.baseUrl,
          config: fields.config,
          appInstallationId: fields.appInstallationId ?? null,
        }),
      )
    } catch (error) {
      if (postgresErrorCode(error) === UNIQUE_VIOLATION) {
        throw new ConflictException("A document source with this external id already exists")
      }
      throw error
    }
  }

  async updateOne(
    connectScope: RequiredConnectScope,
    id: string,
    fields: UpdateDocumentSourceFields,
  ): Promise<DocumentSource | null> {
    const documentSource = await this.findOne(connectScope, id)
    if (!documentSource) return null

    if (fields.name !== undefined) documentSource.name = fields.name
    if (fields.config !== undefined) documentSource.config = fields.config
    return this.repo().save(documentSource)
  }

  async softDeleteOne(connectScope: RequiredConnectScope, id: string): Promise<boolean> {
    const result = await this.repo().softDelete({
      id,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
    })
    return (result.affected ?? 0) > 0
  }

  async deleteOne(connectScope: RequiredConnectScope, id: string): Promise<boolean> {
    const documentSource = await this.findOne(connectScope, id)
    if (!documentSource) return false

    try {
      await this.repo().delete({
        id: documentSource.id,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      })
    } catch (error) {
      if (postgresErrorCode(error) === FOREIGN_KEY_VIOLATION) {
        throw new ConflictException("Document source still has documents attached")
      }
      throw error
    }
    return true
  }

  private repo(): Repository<DocumentSource> {
    return this.transactionService.getManager().getRepository(DocumentSource)
  }
}

type DocumentSourceStatsRow = {
  documentSourceId: string
  documentCount: string | number
  indexedDocumentCount: string | number
  failedDocumentCount: string | number
  lastSyncedAt: Date | string | null
}

function toDate(value: Date | string | null): Date | null {
  if (value == null) return null
  return value instanceof Date ? value : new Date(value)
}

function postgresErrorCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined
  const driverError = error.driverError as { code?: string }
  return driverError.code
}
