import type {
  GlobalPermission,
  ReviewCampaignMembershipForMeDto,
  UserDto,
  UserMembershipsDto,
} from "@caseai-connect/api-contracts"
import { buildNameFromEmail, MeRoutes, updateMeSchema } from "@caseai-connect/api-contracts"
import { Body, Controller, Get, Patch, Req, UseGuards, UsePipes } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentConversationReviewersService } from "@/domains/agents/conversation-reviewers/agent-conversation-reviewers.service"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { toMembershipRoleDto } from "@/domains/memberships/membership-roles"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationsService } from "@/domains/organizations/organizations.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import type { ReviewCampaignMembershipModel } from "@/domains/review-campaigns/memberships/review-campaign-membership.model"
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
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { MeService } from "./me.service"

@UseGuards(JwtAuthGuard, UserGuard)
@Controller()
export class MeController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly meService: MeService,
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
      memberships,
      termsDocuments,
      latestAcceptance,
      globalPermissions,
      conversationReviewAgentIds,
    ] = await Promise.all([
      this.organizationsService.listOrganizations(user.id),
      this.meService.getUserMemberships(user.id),
      this.termsComplianceService.listTermsDocuments(),
      this.termsComplianceService.getLatestAcceptanceForUser(user.id),
      this.permissionService.listGlobalPermissions(user.id),
      this.agentConversationReviewersService.listAgentIdsForUser(user.id),
    ])
    return {
      data: {
        user: toUserDto({
          user,
          memberships,
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
  memberships,
  termsDocuments,
  latestAcceptance,
  globalPermissions,
  conversationReviewAgentIds,
}: {
  user: { id: string; email: string; name: string | null }
  memberships: Awaited<ReturnType<MeService["getUserMemberships"]>>
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
    memberships: toUserMembershipDto(memberships),
    termsAccepted: isAcceptanceUpToDate(latestAcceptance, termsDocuments),
  }
}

function toUserMembershipDto(
  membership: Awaited<ReturnType<MeService["getUserMemberships"]>>,
): UserMembershipsDto {
  return {
    organizationMemberships: membership.organizationMemberships.map((orgMembership) => ({
      id: orgMembership.id,
      organizationId: orgMembership.organizationId,
      roles: orgMembership.roles.map(toMembershipRoleDto),
    })),
    projectMemberships: membership.projectMemberships.map((projectMembership) => ({
      id: projectMembership.id,
      projectId: projectMembership.projectId,
      roles: projectMembership.roles.map(toMembershipRoleDto),
    })),
    agentMemberships: membership.agentMemberships.map((agentMembership) => ({
      id: agentMembership.id,
      agentId: agentMembership.agentId,
      roles: agentMembership.roles.map(toMembershipRoleDto),
    })),
    // Skip rows where the campaign was somehow not loaded (defensive — relation
    // is non-null in the schema). Surface campaignStatus so the UI can mirror
    // listMyCampaigns' active-only filter without an extra round-trip.
    reviewCampaignMemberships: toReviewCampaignMembershipsForMeDto(
      membership.reviewCampaignMemberships.filter(
        (campaignMembership) => !!campaignMembership.campaign,
      ),
    ),
  }
}

/** One entry per campaign, with the user's roles on it (tester, reviewer or both). */
function toReviewCampaignMembershipsForMeDto(
  memberships: ReviewCampaignMembershipModel[],
): ReviewCampaignMembershipForMeDto[] {
  const membershipsByCampaignId = new Map<string, ReviewCampaignMembershipModel[]>()
  for (const membership of memberships) {
    const campaignMemberships = membershipsByCampaignId.get(membership.campaignId)
    if (campaignMemberships) campaignMemberships.push(membership)
    else membershipsByCampaignId.set(membership.campaignId, [membership])
  }

  return [...membershipsByCampaignId.values()].flatMap((campaignMemberships) => {
    const [first] = campaignMemberships
    if (!first) return []
    return [
      {
        id: first.id,
        campaignId: first.campaignId,
        organizationId: first.organizationId,
        projectId: first.projectId,
        roles: campaignMemberships.map((membership) =>
          toMembershipRoleDto(membership.membershipRole),
        ),
        campaignStatus: first.campaign.status,
      },
    ]
  })
}
