import { randomUUID } from "node:crypto"
import {
  type AgentCsvExtractionRunDto,
  type AgentCsvExtractionRunRecordDto,
  type AgentCsvExtractionRunStatusChangedEventDto,
  AgentCsvExtractionRunsRoutes,
  type ProjectMembershipRoleDto,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Post,
  Query,
  Req,
  Sse,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common"
import * as Papa from "papaparse"
import type { Observable } from "rxjs"
import { filter, map } from "rxjs/operators"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentCsvExtractionRun,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  CSV_EXTRACTION_RUN_CREATE_PERMISSION,
  CSV_EXTRACTION_RUN_DELETE_PERMISSION,
  CSV_EXTRACTION_RUN_READ_PERMISSION,
  CSV_EXTRACTION_RUN_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { getTraceUrl } from "@/external/llm/trace-url"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
import type { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunCsvExportService } from "./agent-csv-extraction-run-csv-export.service"
import { AgentCsvExtractionRunPlaygroundGuard } from "./agent-csv-extraction-run-playground.guard"
import type { AgentCsvExtractionRunRecord } from "./agent-csv-extraction-run-record.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunStatusNotifierService } from "./agent-csv-extraction-run-status-notifier.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunStatusStreamService } from "./agent-csv-extraction-run-status-stream.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunsService } from "./agent-csv-extraction-runs.service"

@UseGuards(
  JwtAuthGuard,
  UserGuard,
  ResourceContextGuard,
  CheckPermissionGuard,
  AgentCsvExtractionRunPlaygroundGuard,
)
@RequireContext("organization", "project", "agent")
@Controller()
export class AgentCsvExtractionRunsController {
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

  @Post(AgentCsvExtractionRunsRoutes.createOne.path)
  @CheckPermission(CSV_EXTRACTION_RUN_CREATE_PERMISSION, "project")
  @TrackActivity({ action: "agentCsvExtractionRun.create" })
  async createOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof AgentCsvExtractionRunsRoutes.createOne.request,
  ): Promise<typeof AgentCsvExtractionRunsRoutes.createOne.response> {
    const type = toBaseAgentSessionType(payload.type)
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
        type,
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

  @Post(AgentCsvExtractionRunsRoutes.executeOne.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPermission(CSV_EXTRACTION_RUN_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "agentCsvExtractionRun.execute" })
  async executeOne(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
    @Body() { payload }: typeof AgentCsvExtractionRunsRoutes.executeOne.request,
  ): Promise<typeof AgentCsvExtractionRunsRoutes.executeOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const { agentCsvExtractionRun } = request

    await this.agentCsvExtractionRunsService.enqueueExecuteRun({
      agentCsvExtractionRun,
      connectScope,
      recordLimit: payload?.recordLimit ?? null,
    })

    return { data: toAgentCsvExtractionRunDto(agentCsvExtractionRun) }
  }

  @Post(AgentCsvExtractionRunsRoutes.retryOne.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPermission(CSV_EXTRACTION_RUN_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "agentCsvExtractionRun.retry" })
  async retryOne(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
  ): Promise<typeof AgentCsvExtractionRunsRoutes.retryOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const { agentCsvExtractionRun, agent } = request as EndpointRequestWithAgentCsvExtractionRun &
      EndpointRequestWithAgent

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

  @Post(AgentCsvExtractionRunsRoutes.cancelOne.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPermission(CSV_EXTRACTION_RUN_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "agentCsvExtractionRun.cancel" })
  async cancelOne(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
  ): Promise<typeof AgentCsvExtractionRunsRoutes.cancelOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const agentCsvExtractionRunId = request.agentCsvExtractionRun.id

    await this.agentCsvExtractionRunsService.removePendingJobsForRun({
      agentCsvExtractionRunId,
      connectScope,
    })

    const run = await this.agentCsvExtractionRunsService.markRunCancelled({
      agentCsvExtractionRun: request.agentCsvExtractionRun,
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
      status: run.status,
      summary: run.summary,
      updatedAt: run.updatedAt.getTime(),
    })

    return { data: toAgentCsvExtractionRunDto(run) }
  }

  @Get(AgentCsvExtractionRunsRoutes.getOne.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPermission(CSV_EXTRACTION_RUN_READ_PERMISSION, "project")
  async getOne(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
  ): Promise<typeof AgentCsvExtractionRunsRoutes.getOne.response> {
    return { data: toAgentCsvExtractionRunDto(request.agentCsvExtractionRun) }
  }

  @Get(AgentCsvExtractionRunsRoutes.getAll.path)
  @CheckPermission(CSV_EXTRACTION_RUN_READ_PERMISSION, "project")
  async getAll(
    @Req() request: EndpointRequestWithAgent,
    @Query("type") typeParam?: string,
  ): Promise<typeof AgentCsvExtractionRunsRoutes.getAll.response> {
    const runs = await this.agentCsvExtractionRunsService.listRuns({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
      type: toBaseAgentSessionType(typeParam),
      userId: request.user.id,
    })
    return { data: runs.map(toAgentCsvExtractionRunDto) }
  }

  @Get(AgentCsvExtractionRunsRoutes.getRecords.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPermission(CSV_EXTRACTION_RUN_READ_PERMISSION, "project")
  async getRecords(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
    @Query("page") pageParam?: string,
    @Query("limit") limitParam?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string,
  ): Promise<typeof AgentCsvExtractionRunsRoutes.getRecords.response> {
    const page = Math.max(0, Number(pageParam) || 0)
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 10))
    const validSortOrder = sortOrder === "asc" || sortOrder === "desc" ? sortOrder : undefined

    const { records, total } = await this.agentCsvExtractionRunsService.getRunRecordsPaginated({
      connectScope: getRequiredConnectScope(request),
      runId: request.agentCsvExtractionRun.id,
      page,
      limit,
      sortBy: sortBy || undefined,
      sortOrder: validSortOrder,
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

  @Delete(AgentCsvExtractionRunsRoutes.deleteOne.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPermission(CSV_EXTRACTION_RUN_DELETE_PERMISSION, "project")
  @TrackActivity({ action: "agentCsvExtractionRun.delete" })
  async deleteOne(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
  ): Promise<typeof AgentCsvExtractionRunsRoutes.deleteOne.response> {
    await this.agentCsvExtractionRunsService.deleteRun({
      connectScope: getRequiredConnectScope(request),
      agentCsvExtractionRunId: request.agentCsvExtractionRun.id,
    })
    return { data: { success: true } }
  }

  @CheckPermission(CSV_EXTRACTION_RUN_READ_PERMISSION, "project")
  @Sse(AgentCsvExtractionRunsRoutes.streamRunStatus.path, { method: 0 /* GET */ })
  streamRunStatus(
    @Req() request: EndpointRequestWithAgent,
  ): Observable<AgentCsvExtractionRunStatusChangedEventDto> {
    const connectScope = getRequiredConnectScope(request)
    return this.runStatusStreamService.events$.pipe(
      filter(
        (event) =>
          event.organizationId === connectScope.organizationId &&
          event.projectId === connectScope.projectId &&
          event.agentId === request.agent.id,
      ),
      map((event) => ({ ...event, data: JSON.stringify(event) })),
    )
  }

  @Get(
    "organizations/:organizationId/projects/:projectId/agents/:agentId/csv-extraction-runs/file/:documentId/columns",
  )
  @CheckPermission(CSV_EXTRACTION_RUN_READ_PERMISSION, "project")
  async getFileColumns(
    @Req() request: EndpointRequestWithAgent & { params: { documentId?: string } },
  ): Promise<typeof AgentCsvExtractionRunsRoutes.getFileColumns.response> {
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
 * The requests carrying a type (createOne payload, getAll query) reach the handler even when the
 * field is missing or garbled — the guard only rejects a *named* unknown type — so the handlers
 * narrow it themselves before acting on it.
 */
function toBaseAgentSessionType(type: string | undefined): BaseAgentSessionType {
  if (type !== "live" && type !== "playground") {
    throw new ForbiddenException("A run type of live or playground is required")
  }
  return type
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
