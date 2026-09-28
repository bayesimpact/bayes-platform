import { ConflictException, Injectable } from "@nestjs/common"
import { QueryFailedError, type Repository } from "typeorm"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { DocumentSource } from "./document-source.entity"

const UNIQUE_VIOLATION = "23505"
const FOREIGN_KEY_VIOLATION = "23503"

export type CreateDocumentSourceFields = {
  name: string
  type: string | null
  externalId: string | null
  baseUrl: string | null
  config: Record<string, unknown> | null
}

export type UpdateDocumentSourceFields = {
  name?: string
  config?: Record<string, unknown> | null
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

function postgresErrorCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined
  const driverError = error.driverError as { code?: string }
  return driverError.code
}
