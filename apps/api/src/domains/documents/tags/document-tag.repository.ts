import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { DocumentTag } from "./document-tag.entity"

export type CreateDocumentTagFields = {
  name: string
  description: string | null
  parentId: string | null
}

export type UpdateDocumentTagFields = Partial<
  Pick<DocumentTag, "name" | "description" | "parentId">
>

@Injectable()
export class DocumentTagRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * Tags matched by id, including tags outside the caller's project.
   * Attaching an existing tag looks the row up the same way the previous query did.
   */
  findByIds(ids: string[]): Promise<DocumentTag[]> {
    if (ids.length === 0) return Promise.resolve([])
    return this.repo().findBy({ id: In(ids) })
  }

  createOne(
    connectScope: RequiredConnectScope,
    fields: CreateDocumentTagFields,
  ): Promise<DocumentTag> {
    return this.connectRepo().createAndSave(connectScope, fields)
  }

  list(connectScope: RequiredConnectScope): Promise<DocumentTag[]> {
    return this.connectRepo().getMany(connectScope)
  }

  findOne(connectScope: RequiredConnectScope, documentTagId: string): Promise<DocumentTag | null> {
    return this.connectRepo().getOneById(connectScope, documentTagId)
  }

  updateOne(documentTag: DocumentTag, fields: UpdateDocumentTagFields): Promise<DocumentTag> {
    Object.assign(documentTag, fields)
    return this.connectRepo().saveOne(documentTag)
  }

  async deleteOne(connectScope: RequiredConnectScope, documentTagId: string): Promise<void> {
    // Join rows first, otherwise the tag delete hits a foreign key constraint.
    const manager = this.transactionService.getManager()
    await manager.query("DELETE FROM document_document_tag WHERE document_tag_id = $1", [
      documentTagId,
    ])
    await manager.query("DELETE FROM agent_document_tag WHERE document_tag_id = $1", [
      documentTagId,
    ])
    await this.connectRepo().deleteOneById({ connectScope, id: documentTagId })
  }

  private connectRepo(): ConnectRepository<DocumentTag> {
    return new ConnectRepository(this.repo(), "document-tags")
  }

  private repo(): Repository<DocumentTag> {
    return this.transactionService.getManager().getRepository(DocumentTag)
  }
}
