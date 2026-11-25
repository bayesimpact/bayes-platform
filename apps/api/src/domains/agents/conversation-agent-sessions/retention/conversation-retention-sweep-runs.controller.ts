import {
  ProjectsRoutes,
  type RetentionSweepRunDto,
  type TimeType,
} from "@bayes-platform/api-contracts"
import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { parseExpression } from "cron-parser"
import type { Repository } from "typeorm"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { getConversationRetentionSweepCronPattern } from "./conversation-retention.config"
import { ConversationRetentionSweepRun } from "./conversation-retention-sweep-run.entity"

/** The admin page shows the recent runs; older rows stay queryable in the DB. */
const SWEEP_RUNS_PAGE_SIZE = 30

@Controller()
export class ConversationRetentionSweepRunsController {
  constructor(
    @InjectRepository(ConversationRetentionSweepRun)
    private readonly sweepRunRepository: Repository<ConversationRetentionSweepRun>,
  ) {}

  @Get(ProjectsRoutes.getRetentionSweepRuns.path)
  @UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
  @RequireContext("organization")
  @CheckPermission("project.update", "project")
  @AddContext("project")
  async listRuns(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof ProjectsRoutes.getRetentionSweepRuns.response> {
    const runs = await this.sweepRunRepository.find({
      where: { projectId: request.project.id },
      order: { ranAt: "DESC" },
      take: SWEEP_RUNS_PAGE_SIZE,
    })

    const nextRunAt = parseExpression(getConversationRetentionSweepCronPattern())
      .next()
      .getTime() as TimeType

    return { data: { nextRunAt, runs: runs.map(toRetentionSweepRunDto) } }
  }
}

function toRetentionSweepRunDto(run: ConversationRetentionSweepRun): RetentionSweepRunDto {
  return {
    id: run.id,
    ranAt: run.ranAt.getTime() as TimeType,
    purgedCount: run.purgedCount,
    status: run.status,
    report: run.report,
  }
}
