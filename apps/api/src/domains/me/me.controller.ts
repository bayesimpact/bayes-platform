import type {
  GlobalPermission,
  ReviewCampaignMembershipForMeDto,
  ReviewCampaignPermission,
  UserDto,
  UserMembershipsDto,
} from "@caseai-connect/api-contracts"
import {
  buildNameFromEmail,
  isReviewCampaignPermission,
  MeRoutes,
  updateMeSchema,
} from "@caseai-connect/api-contracts"
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
      reviewCampaignPermissions,
    ] = await Promise.all([
      this.organizationsService.listOrganizations(user.id),
      this.meService.getUserMemberships(user.id),
      this.termsComplianceService.listTermsDocuments(),
      this.termsComplianceService.getLatestAcceptanceForUser(user.id),
      this.permissionService.listGlobalPermissions(user.id),
      this.agentConversationReviewersService.listAgentIdsForUser(user.id),
      this.permissionService.listReviewCampaignPermissionsInGivingStatus(user.id),
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
          reviewCampaignPermissions,
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
  reviewCampaignPermissions,
}: {
  user: { id: string; email: string; name: string | null }
  memberships: Awaited<ReturnType<MeService["getUserMemberships"]>>
  termsDocuments: Awaited<ReturnType<TermsComplianceService["listTermsDocuments"]>>
  latestAcceptance: Awaited<ReturnType<TermsComplianceService["getLatestAcceptanceForUser"]>>
  globalPermissions: string[]
  conversationReviewAgentIds: string[]
  reviewCampaignPermissions: Map<string, string[]>
}): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? buildNameFromEmail(user.email),
    globalPermissions: globalPermissions as GlobalPermission[],
    conversationReviewAgentIds,
    memberships: toUserMembershipDto(memberships, reviewCampaignPermissions),
    termsAccepted: isAcceptanceUpToDate(latestAcceptance, termsDocuments),
  }
}

function toUserMembershipDto(
  membership: Awaited<ReturnType<MeService["getUserMemberships"]>>,
  reviewCampaignPermissions: Map<string, string[]>,
): UserMembershipsDto {
  return {
    organizationMemberships: membership.organizationMemberships.map((orgMembership) => ({
      organizationId: orgMembership.organizationId,
      roles: orgMembership.roles.map(toMembershipRoleDto),
    })),
    projectMemberships: membership.projectMemberships.map((projectMembership) => ({
      projectId: projectMembership.projectId,
      roles: projectMembership.roles.map(toMembershipRoleDto),
    })),
    agentMemberships: membership.agentMemberships.map((agentMembership) => ({
      agentId: agentMembership.agentId,
      roles: agentMembership.roles.map(toMembershipRoleDto),
    })),
    // Skip rows where the campaign was somehow not loaded (defensive — relation
    // is non-null in the schema).
    reviewCampaignMemberships: toReviewCampaignMembershipsForMeDto(
      membership.reviewCampaignMemberships.filter(
        (campaignMembership) => !!campaignMembership.campaign,
      ),
      reviewCampaignPermissions,
    ),
  }
}

/**
 * One entry per campaign, with what the user can do on it now. The front reads these permissions
 * and never the roles, so the campaign status rules stay in the API.
 */
function toReviewCampaignMembershipsForMeDto(
  memberships: ReviewCampaignMembershipModel[],
  reviewCampaignPermissions: Map<string, string[]>,
): ReviewCampaignMembershipForMeDto[] {
  const membershipByCampaignId = new Map<string, ReviewCampaignMembershipModel>()
  for (const membership of memberships) {
    if (!membershipByCampaignId.has(membership.campaignId)) {
      membershipByCampaignId.set(membership.campaignId, membership)
    }
  }

  return [...membershipByCampaignId.values()].map((membership) => ({
    campaignId: membership.campaignId,
    organizationId: membership.organizationId,
    projectId: membership.projectId,
    permissions: toReviewCampaignPermissions(
      reviewCampaignPermissions.get(membership.campaignId) ?? [],
    ),
  }))
}

function toReviewCampaignPermissions(permissions: string[]): ReviewCampaignPermission[] {
  return permissions.filter(isReviewCampaignPermission)
}
