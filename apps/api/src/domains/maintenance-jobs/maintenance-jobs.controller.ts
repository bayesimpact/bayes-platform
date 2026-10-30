import {
  BACKOFFICE_MAINTENANCE_JOB_RUN_PERMISSION,
  BackofficeRoutes,
} from "@caseai-connect/api-contracts"
import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { BackofficeGuard } from "@/domains/backoffice/backoffice.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { MaintenanceJobsService } from "./maintenance-jobs.service"

@UseGuards(JwtAuthGuard, UserGuard, BackofficeGuard, CheckPermissionGuard)
@Controller()
export class MaintenanceJobsController {
  constructor(private readonly maintenanceJobsService: MaintenanceJobsService) {}

  @Get(BackofficeRoutes.listMaintenanceJobs.path)
  @CheckPermission(BACKOFFICE_MAINTENANCE_JOB_RUN_PERMISSION)
  async list(): Promise<typeof BackofficeRoutes.listMaintenanceJobs.response> {
    return { data: { jobs: await this.maintenanceJobsService.list() } }
  }

  @Post(BackofficeRoutes.runMaintenanceJob.path)
  @CheckPermission(BACKOFFICE_MAINTENANCE_JOB_RUN_PERMISSION)
  @TrackActivity({ action: "backoffice.maintenance_job.run" })
  async run(
    @Req() request: EndpointRequest,
    @Param("jobKey") jobKey: string,
  ): Promise<typeof BackofficeRoutes.runMaintenanceJob.response> {
    const job = await this.maintenanceJobsService.run({
      jobKey,
      requestedByUserId: request.user.id,
    })
    return { data: job }
  }
}
