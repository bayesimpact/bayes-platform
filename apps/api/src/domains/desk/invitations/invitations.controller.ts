import { DeskInvitationsRoutes } from "@bayes-platform/desk-contracts"
import { Controller, Req } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type {
  SchemaRouteInput,
  SchemaRouteResponse,
} from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationsService } from "@/domains/invitations/invitations.service"

/**
 * The signed-in person's own invitations. No permission check: the service only finds the
 * invitations held by the caller's account.
 */
@Controller()
export class DeskInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @SchemaRoute(DeskInvitationsRoutes.getMine, { permission: "signed-in" })
  async getMine(
    @Req() request: EndpointRequest,
  ): Promise<SchemaRouteResponse<typeof DeskInvitationsRoutes.getMine>> {
    const invitations = await this.invitationsService.listPendingMine(request.user.id)
    return { data: { invitations: await this.invitationsService.toDtos(invitations) } }
  }

  @SchemaRoute(DeskInvitationsRoutes.acceptOne, {
    permission: "signed-in",
    activity: { action: "invitation.accept" },
  })
  async acceptOne(
    @Req() request: EndpointRequest,
    @RouteInput() { params }: SchemaRouteInput<typeof DeskInvitationsRoutes.acceptOne>,
  ): Promise<SchemaRouteResponse<typeof DeskInvitationsRoutes.acceptOne>> {
    await this.invitationsService.acceptOne({
      invitationId: params.invitationId,
      userId: request.user.id,
    })
    return { data: { success: true } }
  }

  @SchemaRoute(DeskInvitationsRoutes.declineOne, {
    permission: "signed-in",
    activity: { action: "invitation.decline" },
  })
  async declineOne(
    @Req() request: EndpointRequest,
    @RouteInput() { params }: SchemaRouteInput<typeof DeskInvitationsRoutes.declineOne>,
  ): Promise<SchemaRouteResponse<typeof DeskInvitationsRoutes.declineOne>> {
    await this.invitationsService.declineOne({
      invitationId: params.invitationId,
      userId: request.user.id,
    })
    return { data: { success: true } }
  }
}
