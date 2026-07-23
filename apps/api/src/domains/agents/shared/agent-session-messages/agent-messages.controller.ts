import {
  type AgentSessionMessageDto,
  AgentSessionMessagesRoutes,
  agentSessionMessageAttachmentAllowedMimeTypes,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common"
import { v4 } from "uuid"
import type { EndpointRequestWithAgentSession } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { BaseAgentSessionGuard } from "@/domains/agents/base-agent-sessions/base-agent-session.guard"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import {
  extractFileExtension,
  normalizeUploadedFileName,
} from "@/domains/documents/documents.helpers"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { UserGuard } from "@/domains/users/user.guard"
import type { ConversationAgentSession } from "../../conversation-agent-sessions/conversation-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationAgentSessionsService } from "../../conversation-agent-sessions/conversation-agent-sessions.service"
import type { AgentMessage } from "./agent-message.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMessageAttachmentDocumentsService } from "./agent-message-attachment-documents.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, BaseAgentSessionGuard)
@RequireContext("organization", "project", "agent", "agentSession")
@Controller()
export class AgentMessagesController {
  constructor(
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    private readonly agentMessageAttachmentDocumentsService: AgentMessageAttachmentDocumentsService,
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
  ) {}

  @CheckPolicy((policy) => policy.canList())
  @Post(AgentSessionMessagesRoutes.getAll.path)
  async getAll(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
  ): Promise<typeof AgentSessionMessagesRoutes.getAll.response> {
    const connectScope = getRequiredConnectScope(request)
    const agentSessionId = request.agentSession.id
    const messages = await this.conversationAgentSessionsService.listMessagesForSession({
      agentSessionId,
      connectScope,
    })
    return { data: messages.map(toDto) }
  }

  @CheckPolicy((policy) => policy.canList())
  @Post(AgentSessionMessagesRoutes.getOne.path)
  async getOne(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    @Param("messageId") messageId: string, // TODO: add context
  ): Promise<typeof AgentSessionMessagesRoutes.getOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const message = await this.conversationAgentSessionsService.getMessageById({
      id: messageId,
      connectScope,
    })
    if (!message) {
      throw new NotFoundException("Message not found")
    }
    return { data: toDto(message) }
  }

  @CheckPolicy((policy) => policy.canCreate())
  @Post(AgentSessionMessagesRoutes.presignAttachmentDocument.path)
  @HttpCode(HttpStatus.CREATED)
  async presignAttachmentDocument(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    @Body() { payload }: typeof AgentSessionMessagesRoutes.presignAttachmentDocument.request,
  ): Promise<typeof AgentSessionMessagesRoutes.presignAttachmentDocument.response> {
    if (!payload.fileName || !payload.fileName.trim()) {
      throw new UnprocessableEntityException("File name is required.")
    }
    if (!payload.mimeType) {
      throw new UnprocessableEntityException("File MIME type is required.")
    }
    if (typeof payload.size !== "number" || !Number.isFinite(payload.size) || payload.size <= 0) {
      throw new UnprocessableEntityException("File size must be greater than zero.")
    }
    if (!agentSessionMessageAttachmentAllowedMimeTypes.includes(payload.mimeType)) {
      throw new UnprocessableEntityException(
        `Invalid file type: ${payload.mimeType}. Allowed types: PDF, PNG, or JPEG.`,
      )
    }

    const normalizedFileName = normalizeUploadedFileName(payload.fileName)
    const extension = extractFileExtension(normalizedFileName)
    const connectScope = getRequiredConnectScope(request)
    const attachmentDocumentId = v4()
    const storageRelativePath = this.fileStorageService.buildStorageRelativePath({
      connectScope,
      documentId: attachmentDocumentId,
      extension,
    })
    const uploadUrl = await this.fileStorageService.generateSignedUploadUrl({
      storagePath: storageRelativePath,
      mimeType: payload.mimeType,
      expiresInSeconds: 900,
    })

    await this.agentMessageAttachmentDocumentsService.createAttachmentDocument({
      attachmentDocumentId,
      connectScope,
      fields: {
        fileName: normalizedFileName,
        mimeType: payload.mimeType,
        size: payload.size,
        storageRelativePath,
      },
    })

    return { data: { attachmentDocumentId, uploadUrl } }
  }

  @CheckPolicy((policy) => policy.canList())
  @Post(AgentSessionMessagesRoutes.getAttachmentDocumentTemporaryUrl.path)
  async getAttachmentDocumentTemporaryUrl(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    @Param("attachmentDocumentId") attachmentDocumentId: string,
  ): Promise<typeof AgentSessionMessagesRoutes.getAttachmentDocumentTemporaryUrl.response> {
    const attachmentDocument = await this.agentMessageAttachmentDocumentsService.findById({
      connectScope: getRequiredConnectScope(request),
      attachmentDocumentId,
    })
    if (!attachmentDocument) {
      throw new NotFoundException("Attachment document not found")
    }

    return {
      data: {
        url: await this.fileStorageService.getTemporaryUrl(attachmentDocument.storageRelativePath),
      },
    }
  }
}

function toDto(message: AgentMessage): AgentSessionMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status ?? undefined,
    createdAt: message.createdAt.getTime(),
    startedAt: message.startedAt?.getTime(),
    completedAt: message.completedAt?.getTime(),
    toolCalls: (message.toolCalls as AgentSessionMessageDto["toolCalls"]) ?? undefined,
    attachmentDocumentId: message.attachmentDocumentId ?? undefined,
  }
}
