import {
  type AgentCsvExtractionRunStatusChangedEventDto,
  AgentCsvExtractionRunsRoutes,
} from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Get, Post, Query, Req, Sse, UseGuards } from "@nestjs/common"
import type { Observable } from "rxjs"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentCsvExtractionRun,
} from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  CSV_EXTRACTION_RUN_PLAYGROUND_CREATE_PERMISSION,
  CSV_EXTRACTION_RUN_PLAYGROUND_DELETE_PERMISSION,
  CSV_EXTRACTION_RUN_PLAYGROUND_READ_PERMISSION,
  CSV_EXTRACTION_RUN_PLAYGROUND_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { AgentCsvExtractionRunsController } from "./agent-csv-extraction-runs.controller"

const Routes = AgentCsvExtractionRunsRoutes.playground

/**
 * Playground CSV extraction runs, which belong to Studio. The `csv_extraction_run.playground.*`
 * keys keep them to project owners and admins.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class PlaygroundAgentCsvExtractionRunsController extends AgentCsvExtractionRunsController {
  protected readonly type = "playground"

  @Post(Routes.createOne.path)
  @CheckPermission(CSV_EXTRACTION_RUN_PLAYGROUND_CREATE_PERMISSION, "project")
  @TrackActivity({ action: "agentCsvExtractionRun.create" })
  createOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof Routes.createOne.request,
  ): Promise<typeof Routes.createOne.response> {
    return this.handleCreateOne(request, payload)
  }

  @Post(Routes.executeOne.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPermission(CSV_EXTRACTION_RUN_PLAYGROUND_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "agentCsvExtractionRun.execute" })
  executeOne(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
    @Body() body: typeof Routes.executeOne.request | undefined,
  ): Promise<typeof Routes.executeOne.response> {
    return this.handleExecuteOne(request, body?.payload)
  }

  @Post(Routes.retryOne.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPermission(CSV_EXTRACTION_RUN_PLAYGROUND_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "agentCsvExtractionRun.retry" })
  retryOne(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
  ): Promise<typeof Routes.retryOne.response> {
    return this.handleRetryOne(request)
  }

  @Post(Routes.cancelOne.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPermission(CSV_EXTRACTION_RUN_PLAYGROUND_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "agentCsvExtractionRun.cancel" })
  cancelOne(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
  ): Promise<typeof Routes.cancelOne.response> {
    return this.handleCancelOne(request)
  }

  @Get(Routes.getOne.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPermission(CSV_EXTRACTION_RUN_PLAYGROUND_READ_PERMISSION, "project")
  getOne(@Req() request: EndpointRequestWithAgentCsvExtractionRun): typeof Routes.getOne.response {
    return this.handleGetOne(request)
  }

  @Get(Routes.getAll.path)
  @CheckPermission(CSV_EXTRACTION_RUN_PLAYGROUND_READ_PERMISSION, "project")
  getAll(@Req() request: EndpointRequestWithAgent): Promise<typeof Routes.getAll.response> {
    return this.handleGetAll(request)
  }

  @Get(Routes.getRecords.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPermission(CSV_EXTRACTION_RUN_PLAYGROUND_READ_PERMISSION, "project")
  getRecords(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string,
  ): Promise<typeof Routes.getRecords.response> {
    return this.handleGetRecords(request, { page, limit, sortBy, sortOrder })
  }

  @Delete(Routes.deleteOne.path)
  @AddContext("agentCsvExtractionRun")
  @CheckPermission(CSV_EXTRACTION_RUN_PLAYGROUND_DELETE_PERMISSION, "project")
  @TrackActivity({ action: "agentCsvExtractionRun.delete" })
  deleteOne(
    @Req() request: EndpointRequestWithAgentCsvExtractionRun,
  ): Promise<typeof Routes.deleteOne.response> {
    return this.handleDeleteOne(request)
  }

  @CheckPermission(CSV_EXTRACTION_RUN_PLAYGROUND_READ_PERMISSION, "project")
  @Sse(Routes.streamRunStatus.path, { method: 0 /* GET */ })
  streamRunStatus(
    @Req() request: EndpointRequestWithAgent,
  ): Observable<AgentCsvExtractionRunStatusChangedEventDto> {
    return this.handleStreamRunStatus(request)
  }

  @Get(Routes.getFileColumns.path)
  @CheckPermission(CSV_EXTRACTION_RUN_PLAYGROUND_READ_PERMISSION, "project")
  getFileColumns(
    @Req() request: EndpointRequestWithAgent & { params: { documentId?: string } },
  ): Promise<typeof Routes.getFileColumns.response> {
    return this.handleGetFileColumns(request)
  }
}
