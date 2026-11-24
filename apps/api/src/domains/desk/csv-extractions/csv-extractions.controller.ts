import { DeskAgentSessionsRoutes, DeskCsvExtractionsRoutes } from "@caseai-connect/desk-contracts"
import { Controller, Inject, Logger, NotFoundException, Req } from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentCsvExtractionRun,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type {
  SchemaRouteInput,
  SchemaRouteResponse,
} from "@/common/schema-route/schema-route.types"
import { readCsvColumns } from "@/common/utils/csv-columns"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunCsvExportService } from "@/domains/agents/csv-extraction-runs/agent-csv-extraction-run-csv-export.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunStatusNotifierService } from "@/domains/agents/csv-extraction-runs/agent-csv-extraction-run-status-notifier.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunsService } from "@/domains/agents/csv-extraction-runs/agent-csv-extraction-runs.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import {
  CSV_EXTRACTION_RUN_CREATE_PERMISSION,
  CSV_EXTRACTION_RUN_DELETE_PERMISSION,
  CSV_EXTRACTION_RUN_READ_PERMISSION,
  CSV_EXTRACTION_RUN_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import {
  type CsvExtractionRunRecord,
  toCsvExtractionRecordDto,
  toCsvExtractionRunDto,
} from "./csv-extraction.mappers"

const AGENT_CONTEXT = ["organization", "project", "agent"] as const
const RUN_CONTEXT = [...AGENT_CONTEXT, "agentCsvExtractionRun"] as const

/** A request on a route that names a run: the agent and the run come from the path. */
type RunRequest = EndpointRequestWithAgent & EndpointRequestWithAgentCsvExtractionRun

/**
 * The live CSV extraction runs of the signed-in person. A copy of the handlers of
 * `AgentCsvExtractionRunsController`, with the run type fixed to `live`. A live run runs on the
 * settings in production.
 */
@Controller()
export class DeskCsvExtractionsController {
  private readonly logger = new Logger(DeskCsvExtractionsController.name)

  constructor(
    private readonly agentCsvExtractionRunsService: AgentCsvExtractionRunsService,
    private readonly csvExportService: AgentCsvExtractionRunCsvExportService,
    private readonly statusNotifierService: AgentCsvExtractionRunStatusNotifierService,
    private readonly documentsService: DocumentsService,
    private readonly agentSettingsService: AgentSettingsService,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
  ) {}

  @SchemaRoute(DeskAgentSessionsRoutes.getCsvExtractionRuns, {
    permission: { key: CSV_EXTRACTION_RUN_READ_PERMISSION, on: "agent" },
    context: [...AGENT_CONTEXT],
  })
  async getCsvExtractionRuns(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<SchemaRouteResponse<typeof DeskAgentSessionsRoutes.getCsvExtractionRuns>> {
    const runs = await this.agentCsvExtractionRunsService.listRuns({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
      type: "live",
      userId: request.user.id,
    })
    return { data: runs.map(toCsvExtractionRunDto) }
  }

  @SchemaRoute(DeskCsvExtractionsRoutes.getFileColumns, {
    permission: { key: CSV_EXTRACTION_RUN_READ_PERMISSION, on: "agent" },
    context: [...AGENT_CONTEXT],
  })
  async getFileColumns(
    @Req() request: EndpointRequestWithAgent,
    @RouteInput() { params }: SchemaRouteInput<typeof DeskCsvExtractionsRoutes.getFileColumns>,
  ): Promise<SchemaRouteResponse<typeof DeskCsvExtractionsRoutes.getFileColumns>> {
    const document = await this.getRunCsvDocument(request, params.documentId)
    const columns = await readCsvColumns(
      this.fileStorageService.createReadStream(document.storageRelativePath),
    )
    return {
      data: columns.map((column) => ({
        ...column,
        values: column.values.map((value) => value ?? null),
      })),
    }
  }

  @SchemaRoute(DeskCsvExtractionsRoutes.createOne, {
    permission: { key: CSV_EXTRACTION_RUN_CREATE_PERMISSION, on: "agent" },
    context: [...AGENT_CONTEXT],
    activity: { action: "agentCsvExtractionRun.create" },
  })
  async createOne(
    @Req() request: EndpointRequestWithAgent,
    @RouteInput() { payload }: SchemaRouteInput<typeof DeskCsvExtractionsRoutes.createOne>,
  ): Promise<SchemaRouteResponse<typeof DeskCsvExtractionsRoutes.createOne>> {
    const connectScope = getRequiredConnectScope(request)
    await this.getRunCsvDocument(request, payload.csvDocumentId)
    // A live run runs on the version in production.
    const agentSettings = await this.agentSettingsService.getProduction({
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
        type: "live",
        userId: request.user.id,
      },
    })
    return { data: toCsvExtractionRunDto(run) }
  }

  @SchemaRoute(DeskCsvExtractionsRoutes.executeOne, {
    permission: { key: CSV_EXTRACTION_RUN_UPDATE_PERMISSION, on: "agent" },
    context: [...RUN_CONTEXT],
    activity: { action: "agentCsvExtractionRun.execute" },
  })
  async executeOne(
    @Req() request: RunRequest,
    @RouteInput() { payload }: SchemaRouteInput<typeof DeskCsvExtractionsRoutes.executeOne>,
  ): Promise<SchemaRouteResponse<typeof DeskCsvExtractionsRoutes.executeOne>> {
    const agentCsvExtractionRun = this.getRequestRun(request)

    await this.agentCsvExtractionRunsService.enqueueExecuteRun({
      agentCsvExtractionRun,
      connectScope: getRequiredConnectScope(request),
      recordLimit: payload.recordLimit,
    })

    return { data: toCsvExtractionRunDto(agentCsvExtractionRun) }
  }

  @SchemaRoute(DeskCsvExtractionsRoutes.getOne, {
    permission: { key: CSV_EXTRACTION_RUN_READ_PERMISSION, on: "agent" },
    context: [...RUN_CONTEXT],
  })
  async getOne(
    @Req() request: RunRequest,
  ): Promise<SchemaRouteResponse<typeof DeskCsvExtractionsRoutes.getOne>> {
    return { data: toCsvExtractionRunDto(this.getRequestRun(request)) }
  }

  @SchemaRoute(DeskCsvExtractionsRoutes.getRecords, {
    permission: { key: CSV_EXTRACTION_RUN_READ_PERMISSION, on: "agent" },
    context: [...RUN_CONTEXT],
  })
  async getRecords(
    @Req() request: RunRequest,
    @RouteInput() { query }: SchemaRouteInput<typeof DeskCsvExtractionsRoutes.getRecords>,
  ): Promise<SchemaRouteResponse<typeof DeskCsvExtractionsRoutes.getRecords>> {
    const { page, limit, sortBy, sortOrder } = query
    const { records, total } = await this.agentCsvExtractionRunsService.getRunRecordsPaginated({
      connectScope: getRequiredConnectScope(request),
      runId: this.getRequestRun(request).id,
      page,
      limit,
      sortBy: sortBy || undefined,
      sortOrder,
    })

    return {
      data: {
        records: records.map(toCsvExtractionRecordDto),
        total,
        page,
        limit,
      },
    }
  }

  @SchemaRoute(DeskCsvExtractionsRoutes.cancelOne, {
    permission: { key: CSV_EXTRACTION_RUN_UPDATE_PERMISSION, on: "agent" },
    context: [...RUN_CONTEXT],
    activity: { action: "agentCsvExtractionRun.cancel" },
  })
  async cancelOne(
    @Req() request: RunRequest,
  ): Promise<SchemaRouteResponse<typeof DeskCsvExtractionsRoutes.cancelOne>> {
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

    return { data: toCsvExtractionRunDto(run) }
  }

  @SchemaRoute(DeskCsvExtractionsRoutes.retryOne, {
    permission: { key: CSV_EXTRACTION_RUN_UPDATE_PERMISSION, on: "agent" },
    context: [...RUN_CONTEXT],
    activity: { action: "agentCsvExtractionRun.retry" },
  })
  async retryOne(
    @Req() request: RunRequest,
  ): Promise<SchemaRouteResponse<typeof DeskCsvExtractionsRoutes.retryOne>> {
    const connectScope = getRequiredConnectScope(request)
    const agentCsvExtractionRun = this.getRequestRun(request)

    // The run keeps the version it was created on: a retry runs that one, not the one in
    // production now.
    const agentSettings = await this.agentSettingsService.getById({
      connectScope,
      agentSettingsId: agentCsvExtractionRun.agentSettingsId,
    })

    await this.agentCsvExtractionRunsService.retryRun({
      agentCsvExtractionRun,
      connectScope,
      agent: request.agent,
      agentSettings,
    })

    return { data: toCsvExtractionRunDto(agentCsvExtractionRun) }
  }

  /**
   * Served here rather than by the documents route, whose policy lets plain members download only
   * documents tagged `public-documents`: whoever can read the run can download its export.
   */
  @SchemaRoute(DeskCsvExtractionsRoutes.getExportTemporaryUrl, {
    permission: { key: CSV_EXTRACTION_RUN_READ_PERMISSION, on: "agent" },
    context: [...RUN_CONTEXT],
  })
  async getExportTemporaryUrl(
    @Req() request: RunRequest,
  ): Promise<SchemaRouteResponse<typeof DeskCsvExtractionsRoutes.getExportTemporaryUrl>> {
    const { csvExportDocumentId } = this.getRequestRun(request)
    if (!csvExportDocumentId) throw new NotFoundException("This run has no export yet.")

    const exportDocument = await this.documentsService.findById({
      connectScope: getRequiredConnectScope(request),
      documentId: csvExportDocumentId,
    })
    if (!exportDocument) throw new NotFoundException("Export document not found.")

    const url = await this.fileStorageService.getTemporaryUrl(exportDocument.storageRelativePath)
    return { data: { url } }
  }

  @SchemaRoute(DeskCsvExtractionsRoutes.deleteOne, {
    permission: { key: CSV_EXTRACTION_RUN_DELETE_PERMISSION, on: "agent" },
    context: [...RUN_CONTEXT],
    activity: { action: "agentCsvExtractionRun.delete" },
  })
  async deleteOne(
    @Req() request: RunRequest,
  ): Promise<SchemaRouteResponse<typeof DeskCsvExtractionsRoutes.deleteOne>> {
    await this.agentCsvExtractionRunsService.deleteRun({
      connectScope: getRequiredConnectScope(request),
      agentCsvExtractionRunId: this.getRequestRun(request).id,
    })
    return { data: { success: true } }
  }

  /**
   * The CSV a run reads, loaded in the caller's project. It must be a CSV the caller uploaded for
   * a run: a knowledge-base document needs `document.read`, and a colleague's upload is theirs.
   * Anything else answers 404, as if absent.
   */
  private async getRunCsvDocument(request: EndpointRequestWithAgent, documentId: string) {
    const document = await this.documentsService.findById({
      connectScope: getRequiredConnectScope(request),
      documentId,
    })
    const isCallerUpload =
      document?.sourceType === "extraction" && document.userId === request.user.id
    if (!document || !isCallerUpload) {
      throw new NotFoundException(`Document ${documentId} not found`)
    }
    return document
  }

  /**
   * The run resolved from the path, as long as it is a live run, belongs to the agent in the path
   * and is open to the caller. Any other run answers 404, as if it did not exist.
   */
  private getRequestRun(request: RunRequest): CsvExtractionRunRecord {
    const { agent, agentCsvExtractionRun } = request
    if (agentCsvExtractionRun.type !== "live") throw new NotFoundException()
    if (agentCsvExtractionRun.agentSettings.agentId !== agent.id) throw new NotFoundException()
    if (!isRunOpenTo(agentCsvExtractionRun, request.user.id)) throw new NotFoundException()
    return agentCsvExtractionRun
  }
}

/**
 * A run is open to its creator only, whatever the caller's project role. A run created before
 * ownership was tracked has no creator and stays open to every member, as in the list.
 */
function isRunOpenTo(run: { userId: string | null }, userId: string): boolean {
  return run.userId === null || run.userId === userId
}
