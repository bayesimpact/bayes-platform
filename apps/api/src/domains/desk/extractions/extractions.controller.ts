import { DeskAgentSessionsRoutes, DeskExtractionsRoutes } from "@bayes-platform/desk-contracts"
import { Controller, HttpStatus, NotFoundException, Req } from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithDocument,
  EndpointRequestWithExtractionAgentSession,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type {
  SchemaRouteInput,
  SchemaRouteResponse,
} from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { BaseAgentSessionsService } from "@/domains/agents/base-agent-sessions/base-agent-sessions.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ExtractionAgentSessionsService } from "@/domains/agents/extraction-agent-sessions/extraction-agent-sessions.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
import {
  AGENT_EXTRACTION_SESSION_CREATE_PERMISSION,
  AGENT_EXTRACTION_SESSION_DELETE_PERMISSION,
  AGENT_EXTRACTION_SESSION_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import {
  toExtractionDocumentDto,
  toExtractionRunDetailDto,
  toExtractionRunDto,
  toMimeType,
} from "./extraction.mappers"

const AGENT_CONTEXT = ["organization", "project", "agent"] as const
const RUN_CONTEXT = [...AGENT_CONTEXT, "agentSession"] as const
const DOCUMENT_CONTEXT = [...AGENT_CONTEXT, "document"] as const

/**
 * The live extraction runs of the signed-in person, and the documents they upload for them. A
 * copy of the handlers of `ExtractionAgentSessionsController`, with the run type fixed to
 * `live`.
 */
@Controller()
export class DeskExtractionsController {
  constructor(
    private readonly extractionAgentSessionsService: ExtractionAgentSessionsService,
    private readonly baseAgentSessionsService: BaseAgentSessionsService,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly documentsService: DocumentsService,
  ) {}

  @SchemaRoute(DeskAgentSessionsRoutes.getExtractionRuns, {
    permission: { key: AGENT_EXTRACTION_SESSION_READ_PERMISSION, on: "agent" },
    context: [...AGENT_CONTEXT],
  })
  async getExtractionRuns(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<SchemaRouteResponse<typeof DeskAgentSessionsRoutes.getExtractionRuns>> {
    const runs = await this.extractionAgentSessionsService.listRuns({
      connectScope: getRequiredConnectScope(request),
      userId: request.user.id,
      agentId: request.agent.id,
      type: "live",
    })
    return { data: runs.map(toExtractionRunDto) }
  }

  @SchemaRoute(DeskExtractionsRoutes.getOne, {
    permission: { key: AGENT_EXTRACTION_SESSION_READ_PERMISSION, on: "agent" },
    context: [...RUN_CONTEXT],
  })
  async getOne(
    @Req() request: EndpointRequestWithExtractionAgentSession,
  ): Promise<SchemaRouteResponse<typeof DeskExtractionsRoutes.getOne>> {
    if (request.agentSession.type !== "live") throw new NotFoundException()

    return { data: toExtractionRunDetailDto(request.agentSession) }
  }

  @SchemaRoute(DeskExtractionsRoutes.executeOne, {
    permission: { key: AGENT_EXTRACTION_SESSION_CREATE_PERMISSION, on: "agent" },
    context: [...AGENT_CONTEXT],
    activity: { action: "extractionAgentSession.execute" },
  })
  async executeOne(
    @Req() request: EndpointRequestWithAgent,
    @RouteInput() { payload }: SchemaRouteInput<typeof DeskExtractionsRoutes.executeOne>,
  ): Promise<SchemaRouteResponse<typeof DeskExtractionsRoutes.executeOne>> {
    const connectScope = getRequiredConnectScope(request)
    await this.assertRunDocument(request, payload.documentId)
    // A live run executes on the version in production.
    const agentSettings = await this.agentSettingsService.getProduction({
      connectScope,
      agentId: request.agent.id,
    })
    const run = await this.extractionAgentSessionsService.executeExtraction({
      connectScope,
      agent: request.agent,
      agentSettings,
      userId: request.user.id,
      documentId: payload.documentId,
      type: "live",
    })
    return { data: { runId: run.id } }
  }

  @SchemaRoute(DeskExtractionsRoutes.deleteOne, {
    permission: { key: AGENT_EXTRACTION_SESSION_DELETE_PERMISSION, on: "agent" },
    context: [...RUN_CONTEXT],
  })
  async deleteOne(
    @Req() request: EndpointRequestWithExtractionAgentSession,
  ): Promise<SchemaRouteResponse<typeof DeskExtractionsRoutes.deleteOne>> {
    if (request.agentSession.type !== "live") throw new NotFoundException()

    await this.baseAgentSessionsService.deleteAgentSession({
      agentType: "extraction",
      agentId: request.agent.id,
      agentSession: request.agentSession,
    })
    return { data: { success: true } }
  }

  // The document an extraction run reads is uploaded here rather than through the project
  // documents routes: those are for admins and owners, while a live run is open to every member.
  // The browser presigns, PUTs the bytes to the returned URL, then confirms.
  @SchemaRoute(DeskExtractionsRoutes.presignDocument, {
    permission: { key: AGENT_EXTRACTION_SESSION_CREATE_PERMISSION, on: "agent" },
    context: [...AGENT_CONTEXT],
    status: HttpStatus.CREATED,
  })
  async presignDocument(
    @Req() request: EndpointRequestWithAgent,
    @RouteInput() { payload }: SchemaRouteInput<typeof DeskExtractionsRoutes.presignDocument>,
  ): Promise<SchemaRouteResponse<typeof DeskExtractionsRoutes.presignDocument>> {
    const presigned = await this.documentsService.presignUpload({
      connectScope: getRequiredConnectScope(request),
      file: { ...payload.file, mimeType: toMimeType(payload.file.mimeType) },
      sourceType: "extraction",
      userId: request.user.id,
    })
    return { data: presigned }
  }

  @SchemaRoute(DeskExtractionsRoutes.confirmDocument, {
    permission: { key: AGENT_EXTRACTION_SESSION_CREATE_PERMISSION, on: "agent" },
    context: [...AGENT_CONTEXT],
    activity: { action: "extractionAgentSession.uploadDocument" },
    status: HttpStatus.CREATED,
  })
  async confirmDocument(
    @Req() request: EndpointRequestWithAgent,
    @RouteInput() { payload }: SchemaRouteInput<typeof DeskExtractionsRoutes.confirmDocument>,
  ): Promise<SchemaRouteResponse<typeof DeskExtractionsRoutes.confirmDocument>> {
    const connectScope = getRequiredConnectScope(request)
    const { documentId } = payload
    const document = await this.documentsService.findById({ connectScope, documentId })
    // A member may only complete an upload they started; anything else is not theirs to confirm.
    if (!document || document.sourceType !== "extraction" || document.userId !== request.user.id) {
      throw new NotFoundException(`Document ${documentId} not found`)
    }
    await this.documentsService.markAsUploaded({ connectScope, documentId })
    return { data: toExtractionDocumentDto(document) }
  }

  @SchemaRoute(DeskExtractionsRoutes.getMyDocuments, {
    permission: { key: AGENT_EXTRACTION_SESSION_READ_PERMISSION, on: "agent" },
    context: [...AGENT_CONTEXT],
  })
  async getMyDocuments(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<SchemaRouteResponse<typeof DeskExtractionsRoutes.getMyDocuments>> {
    const documents = await this.documentsService.listExtractionDocumentsForUser({
      connectScope: getRequiredConnectScope(request),
      userId: request.user.id,
    })
    return { data: documents.map(toExtractionDocumentDto) }
  }

  // The project documents route deletes any document and stays with admins and owners. Here a
  // caller removes only a document they uploaded for a run; any other answers 404, as if absent.
  @SchemaRoute(DeskExtractionsRoutes.deleteMyDocument, {
    permission: { key: AGENT_EXTRACTION_SESSION_DELETE_PERMISSION, on: "agent" },
    context: [...DOCUMENT_CONTEXT],
    activity: { action: "extractionAgentSession.deleteDocument" },
  })
  async deleteMyDocument(
    @Req() request: EndpointRequestWithAgent & EndpointRequestWithDocument,
  ): Promise<SchemaRouteResponse<typeof DeskExtractionsRoutes.deleteMyDocument>> {
    const { document } = request
    if (document.sourceType !== "extraction" || document.userId !== request.user.id) {
      throw new NotFoundException(`Document ${document.id} not found`)
    }
    await this.documentsService.deleteDocument({
      connectScope: getRequiredConnectScope(request),
      documentId: document.id,
    })
    return { data: { success: true } }
  }

  /**
   * The document a run reads is one the caller may read. A live run, open to every member, reads
   * only a file its caller uploaded for a run: the project's other documents sit behind
   * `document.read`, and a colleague's upload is theirs. Anything else answers 404, as if absent.
   */
  private async assertRunDocument(
    request: EndpointRequestWithAgent,
    documentId: string,
  ): Promise<void> {
    const document = await this.documentsService.findById({
      connectScope: getRequiredConnectScope(request),
      documentId,
    })
    const isCallerUpload =
      document?.sourceType === "extraction" && document.userId === request.user.id
    if (!isCallerUpload) {
      throw new NotFoundException(`Document ${documentId} not found`)
    }
  }
}
