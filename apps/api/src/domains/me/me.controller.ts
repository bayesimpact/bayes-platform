import type { GlobalPermission, UserDto } from "@caseai-connect/api-contracts"
import { buildNameFromEmail, MeRoutes, updateMeSchema } from "@caseai-connect/api-contracts"
import { Body, Controller, Get, Patch, Req, UseGuards, UsePipes } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentConversationReviewersService } from "@/domains/agents/conversation-reviewers/agent-conversation-reviewers.service"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationsService } from "@/domains/organizations/organizations.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import {
  isAcceptanceUpToDate,
  toCurrentTermsDto,
} from "@/domains/terms-compliance/terms-compliance.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TermsComplianceService } from "@/domains/terms-compliance/terms-compliance.service"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UsersService } from "@/domains/users/users.service"
import { toDto as toOrganizationDto } from "../organizations/organization.helpers"

@UseGuards(JwtAuthGuard, UserGuard)
@Controller()
export class MeController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly permissionService: PermissionService,
    private readonly termsComplianceService: TermsComplianceService,
    private readonly usersService: UsersService,
    private readonly agentConversationReviewersService: AgentConversationReviewersService,
  ) {}

  @Patch(MeRoutes.patchMe.path)
  @UsePipes(new ZodValidationPipe(updateMeSchema))
  async patchMe(
    @Req() request: EndpointRequest,
    @Body() body: typeof MeRoutes.patchMe.request,
  ): Promise<typeof MeRoutes.patchMe.response> {
    const { name } = body.payload
    await this.usersService.updateUser(request.user.id, name)
    return { data: { success: true } }
  }

  @Get(MeRoutes.getMe.path)
  async getMe(@Req() request: EndpointRequest): Promise<typeof MeRoutes.getMe.response> {
    const user = request.user
    const [
      organizations,
      termsDocuments,
      latestAcceptance,
      globalPermissions,
      conversationReviewAgentIds,
    ] = await Promise.all([
      this.organizationsService.listOrganizations(user.id),
      this.termsComplianceService.listTermsDocuments(),
      this.termsComplianceService.getLatestAcceptanceForUser(user.id),
      this.permissionService.listGlobalPermissions(user.id),
      this.agentConversationReviewersService.listAgentIdsForUser(user.id),
    ])
    return {
      data: {
        user: toUserDto({
          user,
          termsDocuments,
          latestAcceptance,
          globalPermissions,
          conversationReviewAgentIds,
        }),
        organizations: organizations.map(toOrganizationDto),
        currentTerms: toCurrentTermsDto(termsDocuments),
      },
    }
  }
}

function toUserDto({
  user,
  termsDocuments,
  latestAcceptance,
  globalPermissions,
  conversationReviewAgentIds,
}: {
  user: { id: string; email: string; name: string | null }
  termsDocuments: Awaited<ReturnType<TermsComplianceService["listTermsDocuments"]>>
  latestAcceptance: Awaited<ReturnType<TermsComplianceService["getLatestAcceptanceForUser"]>>
  globalPermissions: string[]
  conversationReviewAgentIds: string[]
}): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? buildNameFromEmail(user.email),
    globalPermissions: globalPermissions as GlobalPermission[],
    conversationReviewAgentIds,
    termsAccepted: isAcceptanceUpToDate(latestAcceptance, termsDocuments),
  }
}
