import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { AgentMessageAttachmentDocument } from "./agent-message-attachment-document.entity"

export type CreateAgentMessageAttachmentDocumentFields = {
  fileName: string
  mimeType: string
  size: number
  storageRelativePath: string
}

@Injectable()
export class AgentMessageAttachmentDocumentsService {
  private readonly attachmentDocumentConnectRepository: ConnectRepository<AgentMessageAttachmentDocument>

  constructor(
    @InjectRepository(AgentMessageAttachmentDocument)
    attachmentDocumentRepository: Repository<AgentMessageAttachmentDocument>,
  ) {
    this.attachmentDocumentConnectRepository = new ConnectRepository(
      attachmentDocumentRepository,
      "agentMessageAttachmentDocument",
    )
  }

  async createAttachmentDocument({
    attachmentDocumentId,
    connectScope,
    fields,
  }: {
    attachmentDocumentId: string
    connectScope: RequiredConnectScope
    fields: CreateAgentMessageAttachmentDocumentFields
  }): Promise<AgentMessageAttachmentDocument> {
    return this.attachmentDocumentConnectRepository.createAndSave(connectScope, {
      id: attachmentDocumentId,
      ...fields,
    })
  }

  async findById({
    attachmentDocumentId,
    connectScope,
  }: {
    attachmentDocumentId: string
    connectScope: RequiredConnectScope
  }): Promise<AgentMessageAttachmentDocument | null> {
    return this.attachmentDocumentConnectRepository.getOneById(connectScope, attachmentDocumentId)
  }

  /**
   * A second row for the same stored file. An attachment row is attached to exactly one message
   * (unique column), so a turn that reuses an attachment already attached to an earlier one, as
   * when an interrupted turn is sent again, gets its own row. Rendered PDF pages are cached under
   * the file path, so the copy keeps the page count and never renders again.
   */
  async copyAttachmentDocument({
    attachmentDocumentId,
    connectScope,
  }: {
    attachmentDocumentId: string
    connectScope: RequiredConnectScope
  }): Promise<AgentMessageAttachmentDocument> {
    const attachmentDocument = await this.findById({ attachmentDocumentId, connectScope })
    if (!attachmentDocument) {
      throw new NotFoundException(`Attachment document with ID ${attachmentDocumentId} not found`)
    }
    return this.attachmentDocumentConnectRepository.createAndSave(connectScope, {
      fileName: attachmentDocument.fileName,
      mimeType: attachmentDocument.mimeType,
      size: attachmentDocument.size,
      storageRelativePath: attachmentDocument.storageRelativePath,
      pdfPageCount: attachmentDocument.pdfPageCount,
    })
  }

  /**
   * Caches the rendered page count for a PDF attachment, so future chat turns
   * referencing the same attachment reuse the already-rendered GCS pages
   * instead of asking the pdf-converter service to render again.
   */
  async updatePdfPageCount({
    attachmentDocumentId,
    connectScope,
    pdfPageCount,
  }: {
    attachmentDocumentId: string
    connectScope: RequiredConnectScope
    pdfPageCount: number
  }): Promise<void> {
    await this.attachmentDocumentConnectRepository.updateOneById({
      connectScope,
      id: attachmentDocumentId,
      fields: { pdfPageCount },
    })
  }
}
