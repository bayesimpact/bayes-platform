import { buildNameFromEmail } from "@caseai-connect/api-contracts"
import { EvalAccountRoutes, type MeUserOutputDto } from "@caseai-connect/eval-contracts"
import { Controller, Req } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type { SchemaRouteResponse } from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"

/** The signed-in person: who they are, and what they may do whatever the project. */
@Controller()
export class EvalAccountController {
  constructor(private readonly permissionService: PermissionService) {}

  /** A copy of `MeController.getMe`, reduced to the fields of the Evaluation contract. */
  @SchemaRoute(EvalAccountRoutes.getMe, { permission: "signed-in" })
  async getMe(
    @Req() request: EndpointRequest,
  ): Promise<SchemaRouteResponse<typeof EvalAccountRoutes.getMe>> {
    const user = request.user
    // The app reads only the person and their global permissions: the organizations, the terms
    // and the reviewed agents that `GET me` also loads are not in its contract.
    const globalPermissions = await this.permissionService.listGlobalPermissions(user.id)
    return { data: { user: toMeUserDto({ user, globalPermissions }) } }
  }
}

function toMeUserDto({
  user,
  globalPermissions,
}: {
  user: { id: string; email: string; name: string | null }
  globalPermissions: string[]
}): MeUserOutputDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? buildNameFromEmail(user.email),
    globalPermissions,
  }
}
