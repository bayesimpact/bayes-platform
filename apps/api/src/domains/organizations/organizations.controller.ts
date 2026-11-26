import { OrganizationsRoutes, updateOrganizationSchema } from "@bayes-platform/api-contracts"
import { Body, Controller, Get, Patch, Post, Req, UseGuards, UsePipes } from "@nestjs/common"
import type {
  EndpointRequest,
  EndpointRequestWithOrganizationId,
} from "@/common/context/request.interface"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { OrganizationGuard } from "./organization.guard"
import { toDto } from "./organization.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationsService } from "./organizations.service"

@Controller()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get(OrganizationsRoutes.getAllMine.path)
  @UseGuards(JwtAuthGuard, UserGuard)
  async listOrganizations(
    @Req() request: EndpointRequest,
  ): Promise<typeof OrganizationsRoutes.getAllMine.response> {
    const organizations = await this.organizationsService.listOrganizations(request.user.id)
    return { data: organizations.map(toDto) }
  }

  @Post(OrganizationsRoutes.createOne.path)
  @UseGuards(JwtAuthGuard, UserGuard, CheckPermissionGuard)
  @CheckPermission("organization.create")
  @TrackActivity({ action: "organization.create" })
  async createOrganization(
    @Req() request: EndpointRequest,
    @Body() body: typeof OrganizationsRoutes.createOne.request,
  ): Promise<typeof OrganizationsRoutes.createOne.response> {
    const organization = await this.organizationsService.createOrganization({
      userId: request.user.id,
      name: body.payload.name,
    })
    return { data: toDto(organization) }
  }

  // We might not need the OrganizationGuard if our check-permission guard is really checking the permission for the organization
  @Patch(OrganizationsRoutes.updateOne.path)
  @UseGuards(JwtAuthGuard, UserGuard, OrganizationGuard, CheckPermissionGuard)
  @CheckPermission("organization.update", "organization")
  @UsePipes(new ZodValidationPipe(updateOrganizationSchema))
  async updateOrganization(
    @Req() request: EndpointRequestWithOrganizationId,
    @Body() body: typeof OrganizationsRoutes.updateOne.request,
  ): Promise<typeof OrganizationsRoutes.updateOne.response> {
    await this.organizationsService.updateOrganizationName({
      organizationId: request.organizationId,
      name: body.payload.name,
    })
    return { data: { success: true } }
  }
}
