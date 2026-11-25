import {
  EvalOrganizationsRoutes,
  type MyOrganizationOutputDto,
} from "@caseai-connect/eval-contracts"
import { Controller, Req } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type { SchemaRouteResponse } from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationsService } from "@/domains/organizations/organizations.service"

type Organization = Awaited<ReturnType<OrganizationsService["listOrganizations"]>>[number]

/** The organizations the signed-in person belongs to. */
@Controller()
export class EvalOrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /** A copy of `OrganizationsController.listOrganizations`. */
  @SchemaRoute(EvalOrganizationsRoutes.getAllMine, { permission: "signed-in" })
  async getAllMine(
    @Req() request: EndpointRequest,
  ): Promise<SchemaRouteResponse<typeof EvalOrganizationsRoutes.getAllMine>> {
    const organizations = await this.organizationsService.listOrganizations(request.user.id)
    return { data: organizations.map(toMyOrganizationDto) }
  }
}

function toMyOrganizationDto(organization: Organization): MyOrganizationOutputDto {
  return { id: organization.id, name: organization.name }
}
