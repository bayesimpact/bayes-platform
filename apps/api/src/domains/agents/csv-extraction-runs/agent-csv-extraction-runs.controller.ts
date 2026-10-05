import { randomUUID } from "node:crypto"
import type {
  AgentCsvExtractionRunDto,
  AgentCsvExtractionRunRecordDto,
  AgentCsvExtractionRunStatusChangedEventDto,
  AgentCsvExtractionRunsRoutes,
  ProjectMembershipRoleDto,
} from "@caseai-connect/api-contracts"
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import * as Papa from "papaparse"
import type { Observable } from "rxjs"
import { filter, map } from "rxjs/operators"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentCsvExtractionRun,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { getTraceUrl } from "@/external/llm/trace-url"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
import type { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunCsvExportService } from "./agent-csv-extraction-run-csv-export.service"
import type { AgentCsvExtractionRunRecord } from "./agent-csv-extraction-run-record.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunStatusNotifierService } from "./agent-csv-extraction-run-status-notifier.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunStatusStreamService } from "./agent-csv-extraction-run-status-stream.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunsService } from "./agent-csv-extraction-runs.service"

type Routes = (typeof AgentCsvExtractionRunsRoutes)[BaseAgentSessionType]

/**
 * Base of the live and playground CSV extraction run controllers. Each subclass serves one run
 * type on its own route set and checks its own permissions, and the handlers here only ever see
 * runs of that type, so a live permission never opens a playground run.
 *
 * This class declares no routes and no guards and is not registered in the module.
 * `@Injectable()` only makes TypeScript emit the constructor metadata the subclasses inherit for
 * dependency injection.
 */
@Injectable()
export abstract class AgentCsvExtractionRunsController {
  protected abstract readonly type: BaseAgentSessionType

  private readonly logger = new Logger(AgentCsvExtractionRunsController.name)

  constructor(
    private readonly agentCsvExtractionRunsService: AgentCsvExtractionRunsService,
    private readonly csvExportService: AgentCsvExtractionRunCsvExportService,
    private readonly runStatusStreamService: AgentCsvExtractionRunStatusStreamService,
    private readonly statusNotifierService: AgentCsvExtractionRunStatusNotifierService,
    private readonly documentsService: DocumentsService,
    private readonly agentSettingsService: AgentSettingsService,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
  ) {}

  protected async handleCreateOne(
    request: EndpointRequestWithAgent,
    payload: Routes["createOne"]["request"]["payload"],
  ): Promise<Routes["createOne"]["response"]> {
    const connectScope = getRequiredConnectScope(request)
    const agentSettings = await this.resolveAgentSettings({
      connectScope,
      agentId: request.agent.id,
      role: request.projectMembership?.role,
      revision: payload.agentSettingsRevision,
    })
    const run = await this.agentCsvExtractionRunsService.createRun({
      connectScope,
      fields: {
        agentId: request.agent.id,
        agentSettingsId: agentSettings.id,
        csvDocumentId: payload.csvDocumentId,
        columnSchema: payload.columnSchema,
        type: this.type,
        userId: request.user.id,
      },
    })
    run.agentSettings = agentSettings
    return { data: toAgentCsvExtractionRunDto(run) }
  }

  /**
   * Settings the run is pinned to.
   *
   * Choosing a version is gated on the caller's project role. Admins and owners are exactly the
   * roles that can list the versions, since the settings history endpoint sits behind the same
   * check. Everyone else keeps getting the newest published revision.
   */
  private async resolveAgentSettings({
    connectScope,
    agentId,
    role,
    revision,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    role: ProjectMembershipRoleDto | undefined
    revision: number | undefined
  }): Promise<AgentSettings> {
    if (revision === undefined) {
      return this.agentSettingsService.getLast({ connectScope, agentId })
    }
    // `agent_settings.revision` is a Postgres `integer`; anything outside its 32-bit signed range
    // reaches TypeORM as-is and produces a driver error instead of a clean rejection here.
    if (!(Number.isInteger(revision) && revision > 0 && revision <= 2147483647)) {
      throw new ForbiddenException("Settings version must be an integer")
    }
    if (role !== "admin" && role !== "owner") {
      throw new ForbiddenException("Choosing a settings version requires managing the agent")
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

  protected async handleExecuteOne(
    request: EndpointRequestWithAgentCsvExtractionRun,
    payload: Routes["executeOne"]["request"]["payload"] | undefined,
  ): Promise<Routes["executeOne"]["response"]> {
    const agentCsvExtractionRun = this.getRequestRun(request)

    await this.agentCsvExtractionRunsService.enqueueExecuteRun({
      agentCsvExtractionRun,
      connectScope: getRequiredConnectScope(request),
      recordLimit: payload?.recordLimit ?? null,
    })

    return { data: toAgentCsvExtractionRunDto(agentCsvExtractionRun) }
  }

  protected async handleRetryOne(
    request: EndpointRequestWithAgentCsvExtractionRun,
  ): Promise<Routes["retryOne"]["response"]> {
    const connectScope = getRequiredConnectScope(request)
    const agentCsvExtractionRun = this.getRequestRun(request)
    const { agent } = request as EndpointRequestWithAgentCsvExtractionRun & EndpointRequestWithAgent

    // The run advertises its own revision, so a retry must use that one. Re-resolving the newest
    // published version here would silently change what a retried run executes.
    const agentSettings = await this.agentSettingsService.getById({
      connectScope,
      agentSettingsId: agentCsvExtractionRun.agentSettingsId,
    })

    await this.agentCsvExtractionRunsService.retryRun({
      agentCsvExtractionRun,
      connectScope,
      agent,
      agentSettings,
    })

    return { data: toAgentCsvExtractionRunDto(agentCsvExtractionRun) }
  }

  protected async handleCancelOne(
    request: EndpointRequestWithAgentCsvExtractionRun,
  ): Promise<Routes["cancelOne"]["response"]> {
    const connectScope = getRequiredConnectScope(request)
    const agentCsvExtractionRun = this.getRequestRun(request)
    const agentCsvExtractionRunId = agentCsvExtractionRun.id

    await this.agentCsvExtractionRunsService.removePendingJobsForRun({
      agentCsvExtractionRunId,
      connectScope,
    })

    const run = await this.agentCsvExtractionRunsService.markRunCancelled({
      agentCsvExtractionRun,
      connectScope,
    })

    try {
      await this.csvExportService.generateAndStoreDocument(run)
    } catch (error) {
      this.logger.error(
        `Failed to generate CSV export for cancelled run ${run.id}: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }

    await this.statusNotifierService.notifyRunStatusChanged({
      agentCsvExtractionRunId,
      organizationId: run.organizationId,
      projectId: run.projectId,
      agentId: run.agentSettings.agentId,
      runType: run.type,
      userId: run.userId,
      status: run.status,
      summary: run.summary,
      updatedAt: run.updatedAt.getTime(),
    })

    return { data: toAgentCsvExtractionRunDto(run) }
  }

  protected handleGetOne(
    request: EndpointRequestWithAgentCsvExtractionRun,
  ): Routes["getOne"]["response"] {
    return { data: toAgentCsvExtractionRunDto(this.getRequestRun(request)) }
  }

  protected async handleGetAll(
    request: EndpointRequestWithAgent,
  ): Promise<Routes["getAll"]["response"]> {
    const runs = await this.agentCsvExtractionRunsService.listRuns({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
      type: this.type,
      userId: request.user.id,
    })
    return { data: runs.map(toAgentCsvExtractionRunDto) }
  }

  protected async handleGetRecords(
    request: EndpointRequestWithAgentCsvExtractionRun,
    query: { page?: string; limit?: string; sortBy?: string; sortOrder?: string },
  ): Promise<Routes["getRecords"]["response"]> {
    const page = Math.max(0, Number(query.page) || 0)
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10))
    const sortOrder =
      query.sortOrder === "asc" || query.sortOrder === "desc" ? query.sortOrder : undefined

    const { records, total } = await this.agentCsvExtractionRunsService.getRunRecordsPaginated({
      connectScope: getRequiredConnectScope(request),
      runId: this.getRequestRun(request).id,
      page,
      limit,
      sortBy: query.sortBy || undefined,
      sortOrder,
    })

    return {
      data: {
        records: records.map(toAgentCsvExtractionRunRecordDto),
        total,
        page,
        limit,
      },
    }
  }

  protected async handleDeleteOne(
    request: EndpointRequestWithAgentCsvExtractionRun,
  ): Promise<Routes["deleteOne"]["response"]> {
    await this.agentCsvExtractionRunsService.deleteRun({
      connectScope: getRequiredConnectScope(request),
      agentCsvExtractionRunId: this.getRequestRun(request).id,
    })
    return { data: { success: true } }
  }

  protected handleStreamRunStatus(
    request: EndpointRequestWithAgent,
  ): Observable<AgentCsvExtractionRunStatusChangedEventDto> {
    const connectScope = getRequiredConnectScope(request)
    return this.runStatusStreamService.events$.pipe(
      filter(
        (event) =>
          event.organizationId === connectScope.organizationId &&
          event.projectId === connectScope.projectId &&
          event.agentId === request.agent.id &&
          event.runType === this.type &&
          isRunOpenTo(event, request.user.id),
      ),
      map((event) => ({ ...event, data: JSON.stringify(event) })),
    )
  }

  protected async handleGetFileColumns(
    request: EndpointRequestWithAgent & { params: { documentId?: string } },
  ): Promise<Routes["getFileColumns"]["response"]> {
    const connectScope = getRequiredConnectScope(request)
    const docId = request.params?.documentId
    if (!docId) {
      throw new UnprocessableEntityException("documentId is required")
    }

    const document = await this.documentsService.findById({ connectScope, documentId: docId })
    if (!document) {
      throw new NotFoundException(`Document with id ${docId} not found`)
    }

    const columns = await this.parseCsvColumns({
      storageRelativePath: document.storageRelativePath,
    })
    return { data: columns }
  }

  /**
   * Returns the run resolved from the path, as long as it is of this controller's type, belongs
   * to the agent in the path and is open to the caller. Any other run answers 404, as if it did
   * not exist.
   */
  private getRequestRun(request: EndpointRequestWithAgentCsvExtractionRun): AgentCsvExtractionRun {
    const { agent, agentCsvExtractionRun } = request as EndpointRequestWithAgentCsvExtractionRun &
      EndpointRequestWithAgent
    if (agentCsvExtractionRun.type !== this.type) throw new NotFoundException()
    if (agentCsvExtractionRun.agentSettings.agentId !== agent.id) throw new NotFoundException()
    if (!isRunOpenTo(agentCsvExtractionRun, request.user.id)) throw new NotFoundException()
    return agentCsvExtractionRun
  }

  private parseCsvColumns({
    storageRelativePath,
  }: {
    storageRelativePath: string
  }): Promise<{ id: string; name: string; values: unknown[] }[]> {
    const sourceStream = this.fileStorageService.createReadStream(storageRelativePath)

    return new Promise((resolve, reject) => {
      const previewRows: Record<string, unknown>[] = []
      let fields: string[] | undefined
      let settled = false
      const preview = 5

      const buildColumns = () => {
        if (!fields || fields.length === 0) {
          reject(new UnprocessableEntityException("CSV file has no columns"))
          return
        }
        resolve(
          fields.map((fieldName) => ({
            id: randomUUID(),
            name: fieldName,
            values: previewRows.map((row) => row[fieldName] ?? null),
          })),
        )
      }

      const settle = (fn: () => void) => {
        if (settled) return
        settled = true
        sourceStream.destroy()
        fn()
      }

      const parseStream = Papa.parse(Papa.NODE_STREAM_INPUT, {
        header: true,
        skipEmptyLines: true,
      })

      parseStream.on("data", (row: Record<string, unknown>) => {
        if (!fields) fields = Object.keys(row)
        previewRows.push(row)
        if (previewRows.length >= preview) {
          settle(buildColumns)
        }
      })
      parseStream.on("end", () => settle(buildColumns))
      parseStream.on("error", (error: Error) => settle(() => reject(error)))
      sourceStream.on("error", (error: Error) => settle(() => reject(error)))
      sourceStream.pipe(parseStream as unknown as NodeJS.WritableStream)
    })
  }
}

/**
 * A run is open to its creator only, whatever the caller's project role. A run created before
 * ownership was tracked has no creator and stays open to every member, as in the list.
 */
function isRunOpenTo(run: { userId: string | null }, userId: string): boolean {
  return run.userId === null || run.userId === userId
}

function toAgentCsvExtractionRunDto(run: AgentCsvExtractionRun): AgentCsvExtractionRunDto {
  return {
    id: run.id,
    agentId: run.agentSettings.agentId,
    agentSettingsId: run.agentSettingsId,
    agentRevision: run.agentSettings.revision,
    csvDocumentId: run.csvDocumentId,
    columnSchema: run.columnSchema,
    type: run.type,
    status: run.status,
    summary: run.summary,
    csvExportDocumentId: run.csvExportDocumentId,
    projectId: run.projectId,
    createdAt: run.createdAt.getTime(),
    updatedAt: run.updatedAt.getTime(),
  }
}

function toAgentCsvExtractionRunRecordDto(
  record: AgentCsvExtractionRunRecord,
): AgentCsvExtractionRunRecordDto {
  return {
    id: record.id,
    agentCsvExtractionRunId: record.agentCsvExtractionRunId,
    rowIndex: record.rowIndex,
    status: record.status,
    inputData: record.inputData,
    agentRawOutput: record.agentRawOutput,
    errorDetails: record.errorDetails,
    traceUrl: record.traceId ? (getTraceUrl(record.traceId) ?? null) : null,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  }
}
