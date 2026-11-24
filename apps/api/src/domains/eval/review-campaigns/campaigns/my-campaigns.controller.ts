import { EvalReviewCampaignsRoutes } from "@caseai-connect/eval-contracts"
import { Controller, Req } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type {
  SchemaRouteInput,
  SchemaRouteResponse,
} from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TesterService } from "@/domains/review-campaigns/tester/tester.service"
import { toMyCampaignDto } from "./campaign.mappers"

/**
 * The campaigns the signed-in person tests or reviews, a copy of
 * `TesterMeController.getMyReviewCampaigns`. No permission check: the service only finds the
 * campaigns where the caller holds the role.
 */
@Controller()
export class EvalMyReviewCampaignsController {
  constructor(private readonly testerService: TesterService) {}

  /** The schema refuses a missing role, which the old handler took as `tester`. */
  @SchemaRoute(EvalReviewCampaignsRoutes.getAllMine, { permission: "signed-in" })
  async getAllMine(
    @Req() request: EndpointRequest,
    @RouteInput() { query }: SchemaRouteInput<typeof EvalReviewCampaignsRoutes.getAllMine>,
  ): Promise<SchemaRouteResponse<typeof EvalReviewCampaignsRoutes.getAllMine>> {
    const campaigns = await this.testerService.listMyCampaigns(request.user.id, query.role)
    return { data: { reviewCampaigns: campaigns.map(toMyCampaignDto) } }
  }
}
