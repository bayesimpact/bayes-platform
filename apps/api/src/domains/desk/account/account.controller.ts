import { buildNameFromEmail } from "@caseai-connect/api-contracts"
import { DeskAccountRoutes, type MeUserOutputDto } from "@caseai-connect/desk-contracts"
import { Controller, Req } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type {
  SchemaRouteInput,
  SchemaRouteResponse,
} from "@/common/schema-route/schema-route.types"
import {
  isAcceptanceUpToDate,
  toCurrentTermsDto,
} from "@/domains/terms-compliance/terms-compliance.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TermsComplianceService } from "@/domains/terms-compliance/terms-compliance.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UsersService } from "@/domains/users/users.service"

/** The signed-in person: who they are, their name, and the terms they accept. */
@Controller()
export class DeskAccountController {
  constructor(
    private readonly termsComplianceService: TermsComplianceService,
    private readonly usersService: UsersService,
  ) {}

  @SchemaRoute(DeskAccountRoutes.getMe, { permission: "signed-in" })
  async getMe(
    @Req() request: EndpointRequest,
  ): Promise<SchemaRouteResponse<typeof DeskAccountRoutes.getMe>> {
    const user = request.user
    // The Desk reads only the person and the terms: the organizations, the global permissions and
    // the reviewed agents that `GET me` also loads are not in its contract.
    const [termsDocuments, latestAcceptance] = await Promise.all([
      this.termsComplianceService.listTermsDocuments(),
      this.termsComplianceService.getLatestAcceptanceForUser(user.id),
    ])
    return {
      data: {
        user: toMeUserDto({ user, termsDocuments, latestAcceptance }),
        currentTerms: toCurrentTermsDto(termsDocuments),
      },
    }
  }

  @SchemaRoute(DeskAccountRoutes.patchMe, { permission: "signed-in" })
  async patchMe(
    @Req() request: EndpointRequest,
    @RouteInput() { payload }: SchemaRouteInput<typeof DeskAccountRoutes.patchMe>,
  ): Promise<SchemaRouteResponse<typeof DeskAccountRoutes.patchMe>> {
    await this.usersService.updateUser(request.user.id, payload.name)
    return { data: { success: true } }
  }

  @SchemaRoute(DeskAccountRoutes.acceptTerms, { permission: "signed-in" })
  async acceptTerms(
    @Req() request: EndpointRequest,
    @RouteInput() { payload }: SchemaRouteInput<typeof DeskAccountRoutes.acceptTerms>,
  ): Promise<SchemaRouteResponse<typeof DeskAccountRoutes.acceptTerms>> {
    await this.termsComplianceService.recordAcceptance({
      userId: request.user.id,
      aiUsagePolicyAccepted: payload.aiUsagePolicyAccepted,
    })
    return { data: { success: true } }
  }
}

function toMeUserDto({
  user,
  termsDocuments,
  latestAcceptance,
}: {
  user: { id: string; email: string; name: string | null }
  termsDocuments: Awaited<ReturnType<TermsComplianceService["listTermsDocuments"]>>
  latestAcceptance: Awaited<ReturnType<TermsComplianceService["getLatestAcceptanceForUser"]>>
}): MeUserOutputDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? buildNameFromEmail(user.email),
    termsAccepted: isAcceptanceUpToDate(latestAcceptance, termsDocuments),
  }
}
