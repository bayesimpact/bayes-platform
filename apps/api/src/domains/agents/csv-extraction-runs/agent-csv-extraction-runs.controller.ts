import { randomUUID } from "node:crypto"
import {
  type AgentCsvExtractionRunDto,
  type AgentCsvExtractionRunRecordDto,
  type AgentCsvExtractionRunStatusChangedEventDto,
  AgentCsvExtractionRunsRoutes,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
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
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { UserGuard } from "@/domains/users/user.guard"
import { getTraceUrl } from "@/external/langfuse/langfuse-helper"
import type { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"
import { AgentCsvExtractionRunGuard } from "./agent-csv-extraction-run.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunCsvExportService } from "./agent-csv-extraction-run-csv-export.service"
import type { AgentCsvExtractionRunRecord } from "./agent-csv-extraction-run-record.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunStatusNotifierService } from "./agent-csv-extraction-run-status-notifier.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunStatusStreamService } from "./agent-csv-extraction-run-status-stream.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunsService } from "./agent-csv-extraction-runs.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, AgentCsvExtractionRunGuard)
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
  @CheckPolicy((policy) => policy.canCreate())
  @TrackActivity({ action: "agentCsvExtractionRun.create" })
  async createOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof AgentCsvExtractionRunsRoutes.createOne.request,
  ): Promise<typeof AgentCsvExtractionRunsRoutes.createOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const agentSettings = await this.agentSettingsService.getLast({
      connectScope,
      agentId: request.agent.id,
    })
    const run = await this.agentCsvExtractionRunsService.createRun({
      connectScope,
      fields: {
        agentId: request.agent.id,
        agentSettingsId: agentSettings.id,
        csvDocumentId: payload.csvDocumentId,
        columnSchema: payload.columnSchema,
      },
    })
    run.agentSettings = agentSettings
    return { data: toAgentCsvExtractionRunDto(run) }
  }

  @Post(AgentCsvExtractionRunsRoutes.executeOne.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPolicy((policy) => policy.canUpdate())
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
  @CheckPolicy((policy) => policy.canUpdate())
  @TrackActivity({ action: "agentCsvExtractionRun.retry" })
  async retryOne(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
  ): Promise<typeof AgentCsvExtractionRunsRoutes.retryOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const { agentCsvExtractionRun, agent } = request as EndpointRequestWithAgentCsvExtractionRun &
      EndpointRequestWithAgent

    const agentSettings = await this.agentSettingsService.getLast({
      connectScope,
      agentId: agent.id,
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
  @CheckPolicy((policy) => policy.canUpdate())
  @TrackActivity({ action: "agentCsvExtractionRun.cancel" })
  async cancelOne(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
  ): Promise<typeof AgentCsvExtractionRunsRoutes.cancelOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const agentCsvExtractionRunId = request.agentCsvExtractionRun.id

    // NOTE: Do not await -> shoot and forget -> no db transaction, it just kills workers jobs
    this.agentCsvExtractionRunsService.removePendingJobsForRun({
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
  @CheckPolicy((policy) => policy.canList())
  async getOne(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
  ): Promise<typeof AgentCsvExtractionRunsRoutes.getOne.response> {
    return { data: toAgentCsvExtractionRunDto(request.agentCsvExtractionRun) }
  }

  @Get(AgentCsvExtractionRunsRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canList())
  async getAll(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<typeof AgentCsvExtractionRunsRoutes.getAll.response> {
    const runs = await this.agentCsvExtractionRunsService.listRuns({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
    })
    return { data: runs.map(toAgentCsvExtractionRunDto) }
  }

  @Get(AgentCsvExtractionRunsRoutes.getRecords.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPolicy((policy) => policy.canList())
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
  @CheckPolicy((policy) => policy.canDelete())
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

  @CheckPolicy((policy) => policy.canList())
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
  @CheckPolicy((policy) => policy.canList())
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

function toAgentCsvExtractionRunDto(run: AgentCsvExtractionRun): AgentCsvExtractionRunDto {
  return {
    id: run.id,
    agentId: run.agentSettings.agentId,
    agentSettingsId: run.agentSettingsId,
    csvDocumentId: run.csvDocumentId,
    columnSchema: run.columnSchema,
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
    traceUrl: record.traceId ? getTraceUrl(record.traceId) : null,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  }
}
