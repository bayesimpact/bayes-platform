import type {
  ExtractionAgentSessionDto,
  ExtractionAgentSessionStatusChangedEventDto,
  ExtractionAgentSessionSummaryDto,
  ExtractionAgentSessionsRoutes,
} from "@caseai-connect/api-contracts"
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { filter, map, type Observable } from "rxjs"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentSession,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { toDocumentDto } from "@/domains/documents/documents.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
import { getTraceUrl } from "@/external/llm/trace-url"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { BaseAgentSessionsService } from "../base-agent-sessions/base-agent-sessions.service"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
import type { ExtractionAgentSession } from "./extraction-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ExtractionAgentSessionStatusStreamService } from "./extraction-agent-session-status-stream.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ExtractionAgentSessionsService } from "./extraction-agent-sessions.service"

type Routes = (typeof ExtractionAgentSessionsRoutes)[BaseAgentSessionType]

/**
 * Base of the live and playground extraction session controllers. Each subclass serves one run
 * type on its own route set and checks its own permissions, and the handlers here only ever see
 * runs of that type, so a live permission never opens a playground run.
 *
 * This class declares no routes and no guards and is not registered in the module.
 * `@Injectable()` only makes TypeScript emit the constructor metadata the subclasses inherit for
 * dependency injection.
 */
@Injectable()
export abstract class ExtractionAgentSessionsController {
  protected abstract readonly type: BaseAgentSessionType

  constructor(
    private readonly extractionAgentSessionsService: ExtractionAgentSessionsService,
    private readonly baseAgentSessionsService: BaseAgentSessionsService,
    private readonly sessionStatusStreamService: ExtractionAgentSessionStatusStreamService,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly documentsService: DocumentsService,
  ) {}

  protected async handleExecuteOne(
    request: EndpointRequestWithAgent,
    { documentId, agentSettingsRevision }: Routes["executeOne"]["request"]["payload"],
  ): Promise<Routes["executeOne"]["response"]> {
    // `agent_settings.revision` is a Postgres `integer`; anything outside its 32-bit signed range
    // reaches TypeORM as-is and produces a driver error instead of a clean rejection here.
    if (
      agentSettingsRevision !== undefined &&
      !(
        Number.isInteger(agentSettingsRevision) &&
        agentSettingsRevision > 0 &&
        agentSettingsRevision <= 2147483647
      )
    ) {
      throw new ForbiddenException("Settings version must be an integer")
    }
    if (agentSettingsRevision !== undefined && this.type !== "playground") {
      throw new ForbiddenException(
        "Choosing a settings version is only available in the playground",
      )
    }

    const connectScope = getRequiredConnectScope(request)
    const agentSettings = await this.resolveAgentSettings({
      connectScope,
      agentId: request.agent.id,
      revision: agentSettingsRevision,
    })
    const run = await this.extractionAgentSessionsService.executeExtraction({
      connectScope,
      agent: request.agent,
      agentSettings,
      userId: request.user.id,
      documentId,
      type: this.type,
    })
    return { data: { runId: run.id } }
  }

  /**
   * Settings the run is pinned to, which is what its worker will use.
   *
   * A playground run with no explicit revision uses the draft when there is one. The extraction
   * screen renders before its settings history has loaded, so the client cannot always name a
   * revision, and defaulting that window to the published one would run a version the picker does
   * not claim. A live run keeps using the newest published revision; it can never reach here with
   * a revision, that is rejected in the handler.
   */
  private async resolveAgentSettings({
    connectScope,
    agentId,
    revision,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    revision: number | undefined
  }): Promise<AgentSettings> {
    if (revision === undefined) {
      return this.type === "playground"
        ? this.agentSettingsService.getLast({ connectScope, agentId, includesDraft: true })
        : this.agentSettingsService.getLast({ connectScope, agentId })
    }

    const agentSettings = await this.agentSettingsService.get({ connectScope, agentId, revision })
    if (!agentSettings) {
      throw new NotFoundException(`Version ${revision} not found for agent ${agentId}`)
    }
    if (agentSettings.isArchived) {
      throw new UnprocessableEntityException(`Version ${revision} is archived and cannot be run`)
    }
    return agentSettings
  }

  protected handleStreamSessionStatus(
    request: EndpointRequestWithAgent,
  ): Observable<ExtractionAgentSessionStatusChangedEventDto> {
    const connectScope = getRequiredConnectScope(request)
    return this.sessionStatusStreamService.events$.pipe(
      filter(
        (event) =>
          event.organizationId === connectScope.organizationId &&
          event.projectId === connectScope.projectId &&
          event.agentId === request.agent.id,
      ),
      map((event) => ({ ...event, data: JSON.stringify(event) })),
    )
  }

  protected async handleGetAll(
    request: EndpointRequestWithAgent,
  ): Promise<Routes["getAll"]["response"]> {
    const agentSessions = await this.extractionAgentSessionsService.listRuns({
      connectScope: getRequiredConnectScope(request),
      userId: request.user.id,
      agentId: request.agent.id,
      type: this.type,
    })
    return { data: agentSessions.map(toSummaryDto(this.type)) }
  }

  protected async handleGetOne(
    request: EndpointRequestWithAgentSession<ExtractionAgentSession>,
  ): Promise<Routes["getOne"]["response"]> {
    if (request.agentSession.type !== this.type) throw new NotFoundException()

    return { data: toDto(this.type)(request.agentSession) }
  }

  protected async handleDeleteOne(
    request: EndpointRequestWithAgentSession<ExtractionAgentSession>,
  ): Promise<Routes["deleteOne"]["response"]> {
    if (request.agentSession.type !== this.type) throw new NotFoundException()

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
  protected async handlePresignDocument(
    request: EndpointRequestWithAgent,
    { file }: Routes["presignDocument"]["request"]["payload"],
  ): Promise<Routes["presignDocument"]["response"]> {
    if (!file) {
      throw new UnprocessableEntityException("A file is required.")
    }

    const presigned = await this.documentsService.presignUpload({
      connectScope: getRequiredConnectScope(request),
      file,
      sourceType: "extraction",
      userId: request.user.id,
    })
    return { data: presigned }
  }

  protected async handleConfirmDocument(
    request: EndpointRequestWithAgent,
    { documentId }: Routes["confirmDocument"]["request"]["payload"],
  ): Promise<Routes["confirmDocument"]["response"]> {
    if (!documentId) {
      throw new UnprocessableEntityException("A document ID is required.")
    }

    const connectScope = getRequiredConnectScope(request)
    const document = await this.documentsService.findById({ connectScope, documentId })
    // A member may only complete an upload they started; anything else is not theirs to confirm.
    if (!document || document.sourceType !== "extraction" || document.userId !== request.user.id) {
      throw new NotFoundException(`Document ${documentId} not found`)
    }
    await this.documentsService.markAsUploaded({ connectScope, documentId })
    return { data: toDocumentDto(document) }
  }

  protected async handleListMyDocuments(
    request: EndpointRequestWithAgent,
  ): Promise<Routes["listMyDocuments"]["response"]> {
    const documents = await this.documentsService.listExtractionDocumentsForUser({
      connectScope: getRequiredConnectScope(request),
      userId: request.user.id,
    })
    return { data: documents.map(toDocumentDto) }
  }
}

function toSummaryDto(agentSessionType: BaseAgentSessionType) {
  return (entity: ExtractionAgentSession): ExtractionAgentSessionSummaryDto => {
    const traceUrl = agentSessionType === "live" ? undefined : getTraceUrl(entity.traceId)
    return {
      id: entity.id,
      agentId: entity.agentId,
      agentRevision: entity.agentSettings.revision,
      documentId: entity.documentId,
      documentFileName: entity.document?.fileName ?? null,
      traceUrl,
      type: entity.type,
      status: entity.status,
      createdAt: entity.createdAt.getTime(),
      updatedAt: entity.updatedAt.getTime(),
    }
  }
}

function toDto(agentSessionType: BaseAgentSessionType) {
  return (entity: ExtractionAgentSession): ExtractionAgentSessionDto => {
    return {
      ...toSummaryDto(agentSessionType)(entity),
      result: entity.result,
      errorCode: entity.errorCode,
      errorDetails: entity.errorDetails,
    }
  }
}
