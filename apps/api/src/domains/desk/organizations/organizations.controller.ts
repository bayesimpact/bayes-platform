import { DeskOrganizationsRoutes } from "@caseai-connect/desk-contracts"
import { Controller, Req } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type { SchemaRouteResponse } from "@/common/schema-route/schema-route.types"
import { toDto as toOrganizationDto } from "@/domains/organizations/organization.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationsService } from "@/domains/organizations/organizations.service"

/** The organizations the signed-in person belongs to. */
@Controller()
export class DeskOrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @SchemaRoute(DeskOrganizationsRoutes.getAllMine, { permission: "signed-in" })
  async getAllMine(
    @Req() request: EndpointRequest,
  ): Promise<SchemaRouteResponse<typeof DeskOrganizationsRoutes.getAllMine>> {
    const organizations = await this.organizationsService.listOrganizations(request.user.id)
    return { data: organizations.map(toOrganizationDto) }
  }
}
