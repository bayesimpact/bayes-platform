import type { GlobalPermission, UserDto, UserMembershipsDto } from "@caseai-connect/api-contracts"
import { buildNameFromEmail, MeRoutes, updateMeSchema } from "@caseai-connect/api-contracts"
import { Body, Controller, Get, Patch, Req, UseGuards, UsePipes } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import {
  isDomainBackofficeAuthorized,
  isEmailBackofficeAuthorized,
} from "@/domains/backoffice/backoffice.authorization"
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
    const [organizations, memberships, termsDocuments, latestAcceptance, globalPermissions] =
      await Promise.all([
        this.organizationsService.listOrganizations(user.id),
        this.meService.getUserMemberships(user.id),
        this.termsComplianceService.listTermsDocuments(),
        this.termsComplianceService.getLatestAcceptanceForUser(user.id),
        this.permissionService.listGlobalPermissions(user.id),
      ])
    return {
      data: {
        user: toUserDto({ user, memberships, termsDocuments, latestAcceptance, globalPermissions }),
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
}: {
  user: { id: string; email: string; name: string | null }
  memberships: Awaited<ReturnType<MeService["getUserMemberships"]>>
  termsDocuments: Awaited<ReturnType<TermsComplianceService["listTermsDocuments"]>>
  latestAcceptance: Awaited<ReturnType<TermsComplianceService["getLatestAcceptanceForUser"]>>
  globalPermissions: string[]
}): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? buildNameFromEmail(user.email),
    globalPermissions: globalPermissions as GlobalPermission[],
    memberships: toUserMembershipDto(memberships),
    isBackofficeAuthorized: isDomainBackofficeAuthorized(user.email),
    isTermsManagementAuthorized: isEmailBackofficeAuthorized(user.email),
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
      role: orgMembership.role,
    })),
    projectMemberships: membership.projectMemberships.map((projectMembership) => ({
      id: projectMembership.id,
      projectId: projectMembership.projectId,
      role: projectMembership.role,
    })),
    agentMemberships: membership.agentMemberships.map((agentMembership) => ({
      id: agentMembership.id,
      agentId: agentMembership.agentId,
      role: agentMembership.role,
    })),
    // Skip rows where the campaign was somehow not loaded (defensive — relation
    // is non-null in the schema). Surface campaignStatus so the UI can mirror
    // listMyCampaigns' active-only filter without an extra round-trip.
    reviewCampaignMemberships: membership.reviewCampaignMemberships
      .filter((m) => !!m.campaign)
      .map((m) => ({
        id: m.id,
        campaignId: m.campaignId,
        organizationId: m.organizationId,
        projectId: m.projectId,
        role: m.role,
        campaignStatus: m.campaign.status,
      })),
  }
}
