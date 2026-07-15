import { OrganizationsRoutes, updateOrganizationSchema } from "@caseai-connect/api-contracts"
import { Body, Controller, Patch, Post, Req, UseGuards, UsePipes } from "@nestjs/common"
import type {
  EndpointRequest,
  EndpointRequestWithOrganizationMembership,
} from "@/common/context/request.interface"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
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
import { OrganizationsPolicyGuard } from "./organizations-policy.guard"

@Controller()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post(OrganizationsRoutes.createOrganization.path)
  @UseGuards(JwtAuthGuard, UserGuard, OrganizationsPolicyGuard)
  @CheckPolicy((policy) => policy.canCreate())
  @TrackActivity({ action: "organization.create" })
  async createOrganization(
    @Req() request: EndpointRequest,
    @Body() body: typeof OrganizationsRoutes.createOrganization.request,
  ): Promise<typeof OrganizationsRoutes.createOrganization.response> {
    const organization = await this.organizationsService.createOrganization({
      userId: request.user.id,
      name: body.payload.name,
    })
    return { data: toDto({ ...organization, projects: [] }) }
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
