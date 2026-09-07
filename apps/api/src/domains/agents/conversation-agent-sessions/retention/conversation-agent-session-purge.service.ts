import { Inject, Injectable, Logger } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource, type EntityManager, In } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PdfPagesService } from "@/domains/documents/pdf-pages/pdf-pages.service"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { AgentMessage } from "../../shared/agent-session-messages/agent-message.entity"
import { AgentMessageAttachmentDocument } from "../../shared/agent-session-messages/agent-message-attachment-document.entity"
import { AgentMessageFeedback } from "../../shared/agent-session-messages/feedback/agent-message-feedback.entity"
import { ConversationAgentSession } from "../conversation-agent-session.entity"

/** What is needed to remove a deleted document's source object and rendered pages from storage. */
type StoredDocumentFiles = { storageRelativePath: string; pdfPageCount: number | null }

/**
 * GDPR content purge: empties everything user-generated in a conversation
 * session while KEEPING every row. Analytics count session/message rows,
 * roles, timestamps and categories — none of that is touched (issue #208).
 */
@Injectable()
export class ConversationAgentSessionPurgeService {
  private readonly logger = new Logger(ConversationAgentSessionPurgeService.name)

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(FILE_STORAGE_SERVICE) private readonly fileStorage: IFileStorage,
    private readonly pdfPagesService: PdfPagesService,
  ) {}

  async purgeSessionContent(sessionId: string): Promise<{ purged: boolean }> {
    const deletedDocumentFiles: StoredDocumentFiles[] = []

    const purged = await this.dataSource.transaction(async (entityManager) => {
      const session = await entityManager.findOne(ConversationAgentSession, {
        where: { id: sessionId },
      })
      if (!session || session.purgedAt) return false

      deletedDocumentFiles.push(...(await this.purgeSessionMessages(entityManager, sessionId)))

      await entityManager.update(
        ConversationAgentSession,
        { id: sessionId },
        { title: null, result: null, purgedAt: new Date() },
      )
      return true
    })

    await this.deleteStoredFiles(deletedDocumentFiles, sessionId)
    return { purged }
  }

  /**
   * Same purge for an embed (public) session: the session row, its categories
   * and timestamps stay for stats, but externalVisitorId is also cleared so
   * the purged session no longer links to a person.
   */
  async purgePublicSessionContent(sessionId: string): Promise<{ purged: boolean }> {
    const deletedDocumentFiles: StoredDocumentFiles[] = []

    const purged = await this.dataSource.transaction(async (entityManager) => {
      // Loaded by entity name: importing the PublicAgentSession entity here
      // would be a cross-domain entity import (no-cross-domain-entity-import).
      const session = (await entityManager.findOne("PublicAgentSession", {
        where: { id: sessionId },
      })) as { id: string; purgedAt: Date | null } | null
      if (!session || session.purgedAt) return false

      deletedDocumentFiles.push(...(await this.purgeSessionMessages(entityManager, sessionId)))

      await entityManager.update(
        "PublicAgentSession",
        { id: sessionId },
        { title: null, result: null, externalVisitorId: null, purgedAt: new Date() },
      )
      return true
    })

    await this.deleteStoredFiles(deletedDocumentFiles, sessionId)
    return { purged }
  }

  /** Empties the messages of a session; returns the stored files of the deleted documents. */
  private async purgeSessionMessages(
    entityManager: EntityManager,
    sessionId: string,
  ): Promise<StoredDocumentFiles[]> {
    const deletedDocumentFiles: StoredDocumentFiles[] = []

    const messages = await entityManager.find(AgentMessage, {
      where: { sessionId },
      select: { id: true, documentId: true, attachmentDocumentId: true },
    })
    const messageIds = messages.map((message) => message.id)

    if (messageIds.length > 0) {
      // Feedback free text is user content; the row and its vote stay for stats.
      await entityManager.update(
        AgentMessageFeedback,
        { agentMessageId: In(messageIds) },
        { content: "" },
      )
    }

    const attachmentDocumentIds = messages
      .map((message) => message.attachmentDocumentId)
      .filter((id): id is string => Boolean(id))
    if (attachmentDocumentIds.length > 0) {
      const attachments = await entityManager.find(AgentMessageAttachmentDocument, {
        where: { id: In(attachmentDocumentIds) },
      })
      deletedDocumentFiles.push(...attachments)
      await entityManager.delete(AgentMessageAttachmentDocument, {
        id: In(attachmentDocumentIds),
      })
    }

    const generatedDocumentIds = messages
      .map((message) => message.documentId)
      .filter((id): id is string => Boolean(id))
    if (generatedDocumentIds.length > 0) {
      // Loaded and deleted by entity name: importing the Document entity here
      // would be a cross-domain entity import (no-cross-domain-entity-import).
      const generatedDocuments = await entityManager.find<StoredDocumentFiles & { id: string }>(
        "Document",
        {
          where: { id: In(generatedDocumentIds) },
          select: { storageRelativePath: true, pdfPageCount: true },
        },
      )
      deletedDocumentFiles.push(...generatedDocuments)
      await entityManager.delete("Document", { id: In(generatedDocumentIds) })
    }

    await entityManager.update(AgentMessage, { sessionId }, { content: "", toolCalls: null })
    return deletedDocumentFiles
  }

  // Storage cleanup happens after commit: a storage hiccup must not resurrect
  // the DB content, and a missing file is not an error.
  private async deleteStoredFiles(
    deletedDocumentFiles: StoredDocumentFiles[],
    sessionId: string,
  ): Promise<void> {
    for (const document of deletedDocumentFiles) {
      // Generated documents may have no stored file (content lives in the row only).
      if (!document.storageRelativePath) continue
      try {
        await Promise.all([
          this.fileStorage.deleteFile(document.storageRelativePath),
          this.pdfPagesService.deleteRenderedPages({
            document,
            fileStorageService: this.fileStorage,
          }),
        ])
      } catch (error) {
        this.logger.warn(
          `Could not delete stored files ${document.storageRelativePath} for purged session ${sessionId}: ${(error as Error).message}`,
        )
      }
    }
  }
}
