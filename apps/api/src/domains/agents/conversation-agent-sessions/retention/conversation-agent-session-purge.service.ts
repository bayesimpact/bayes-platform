import { Inject, Injectable, Logger } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource, In } from "typeorm"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { AgentMessage } from "../../shared/agent-session-messages/agent-message.entity"
import { AgentMessageAttachmentDocument } from "../../shared/agent-session-messages/agent-message-attachment-document.entity"
import { AgentMessageFeedback } from "../../shared/agent-session-messages/feedback/agent-message-feedback.entity"
import { ConversationAgentSession } from "../conversation-agent-session.entity"

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
  ) {}

  async purgeSessionContent(sessionId: string): Promise<{ purged: boolean }> {
    const attachmentStoragePaths: string[] = []

    const purged = await this.dataSource.transaction(async (entityManager) => {
      const session = await entityManager.findOne(ConversationAgentSession, {
        where: { id: sessionId },
      })
      if (!session || session.purgedAt) return false

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
        attachmentStoragePaths.push(
          ...attachments.map((attachment) => attachment.storageRelativePath),
        )
        await entityManager.delete(AgentMessageAttachmentDocument, {
          id: In(attachmentDocumentIds),
        })
      }

      const generatedDocumentIds = messages
        .map((message) => message.documentId)
        .filter((id): id is string => Boolean(id))
      if (generatedDocumentIds.length > 0) {
        // Deleted by entity name: importing the Document entity here would be a
        // cross-domain entity import (no-cross-domain-entity-import).
        await entityManager.delete("Document", { id: In(generatedDocumentIds) })
      }

      await entityManager.update(AgentMessage, { sessionId }, { content: "", toolCalls: null })
      await entityManager.update(
        ConversationAgentSession,
        { id: sessionId },
        { title: null, result: null, purgedAt: new Date() },
      )
      return true
    })

    // Storage cleanup happens after commit: a storage hiccup must not resurrect
    // the DB content, and a missing file is not an error.
    for (const storageRelativePath of attachmentStoragePaths) {
      try {
        await this.fileStorage.deleteFile(storageRelativePath)
      } catch (error) {
        this.logger.warn(
          `Could not delete attachment file ${storageRelativePath} for purged session ${sessionId}: ${(error as Error).message}`,
        )
      }
    }

    return { purged }
  }
}
