import { OrganizationsRoutes, updateOrganizationSchema } from "@caseai-connect/api-contracts"
import { Body, Controller, Get, Patch, Post, Req, UseGuards, UsePipes } from "@nestjs/common"
import type {
  EndpointRequest,
  EndpointRequestWithOrganizationMembership,
} from "@/common/context/request.interface"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { OrganizationGuard } from "./organization.guard"
import { toDto, toUserOrganizationListItemDto } from "./organization.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationsService } from "./organizations.service"

@Controller()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get(OrganizationsRoutes.listOrganizations.path)
  @UseGuards(JwtAuthGuard, UserGuard)
  async listOrganizations(
    @Req() request: EndpointRequest,
  ): Promise<typeof OrganizationsRoutes.listOrganizations.response> {
    const organizations = await this.organizationsService.listUserOrganizations(request.user.id)
    return { data: organizations.map(toUserOrganizationListItemDto) }
  }

  @Post(OrganizationsRoutes.createOrganization.path)
  @UseGuards(JwtAuthGuard, UserGuard, CheckPermissionGuard)
  @CheckPermission("organization.create")
  @TrackActivity({ action: "organization.create" })
  async createOrganization(
    @Req() request: EndpointRequest,
    @Body() body: typeof OrganizationsRoutes.createOrganization.request,
  ): Promise<typeof OrganizationsRoutes.createOrganization.response> {
    const organization = await this.organizationsService.createOrganization({
      userId: request.user.id,
      name: body.payload.name,
    })
    return { data: toDto(organization, []) }
  }

  @Patch(OrganizationsRoutes.updateOrganization.path)
  @UseGuards(JwtAuthGuard, UserGuard, OrganizationGuard, CheckPermissionGuard)
  @CheckPermission("organization.update", "organization")
  @UsePipes(new ZodValidationPipe(updateOrganizationSchema))
  async updateOrganization(
    @Req() request: EndpointRequestWithOrganizationMembership,
    @Body() body: typeof OrganizationsRoutes.updateOrganization.request,
  ): Promise<typeof OrganizationsRoutes.updateOrganization.response> {
    await this.organizationsService.updateOrganizationName({
      organizationId: request.organizationId,
      name: body.payload.name,
    })
    return { data: { success: true } }
  }
}
