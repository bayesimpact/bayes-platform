import { MemberGrantsRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, NotFoundException, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithMemberGrantScope } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { MemberGrantsGuard } from "./member-grants.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { MemberGrantsService, type MemberGrantTarget } from "./member-grants.service"

@Controller()
export class MemberGrantsController {
  constructor(private readonly memberGrantsService: MemberGrantsService) {}

  @UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, MemberGrantsGuard)
  @RequireContext("memberGrantScope")
  @CheckPolicy((policy) => policy.canCreate())
  @Post(MemberGrantsRoutes.createMany.path)
  @TrackActivity({ action: "member_grant.create" })
  async createMany(
    @Req() request: EndpointRequestWithMemberGrantScope,
    @Body() body: typeof MemberGrantsRoutes.createMany.request,
  ): Promise<typeof MemberGrantsRoutes.createMany.response> {
    const grantedEmails = await this.memberGrantsService.grantAccess({
      target: toMemberGrantTarget(body.payload.targetType, request.memberGrantTarget),
      emails: body.payload.emails ?? [],
      role: body.payload.role,
    })
    return { data: { grantedEmails } }
  }
}

type AgentTarget = Extract<MemberGrantTarget, { type: "agent" }>["agent"]
type ReviewCampaignTarget = Extract<
  MemberGrantTarget,
  { type: "review_campaign" }
>["reviewCampaign"]

/** The scope resolver already loaded the target entity matching `targetType`. */
function toMemberGrantTarget(
  targetType: typeof MemberGrantsRoutes.createMany.request.payload.targetType,
  target: EndpointRequestWithMemberGrantScope["memberGrantTarget"],
): MemberGrantTarget {
  if (!target) throw new NotFoundException()
  switch (targetType) {
    case "project":
      return { type: "project", project: target }
    case "agent":
      return { type: "agent", agent: target as AgentTarget }
    case "review_campaign":
      return { type: "review_campaign", reviewCampaign: target as ReviewCampaignTarget }
  }
}
