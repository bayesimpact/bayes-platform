import { buildNameFromEmail, MeRoutes } from "@caseai-connect/api-contracts"
import type {
  PendingAgentInvitationDto,
  PendingProjectInvitationDto,
  UserMembershipsDto,
} from "@caseai-connect/api-contracts/src/me/me.dto"
import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import {
  isDomainBackofficeAuthorized,
  isEmailBackofficeAuthorized,
} from "@/domains/backoffice/backoffice.authorization"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationsService } from "@/domains/organizations/organizations.service"
import {
  isAcceptanceUpToDate,
  toCurrentTermsDto,
} from "@/domains/terms-compliance/terms-compliance.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TermsComplianceService } from "@/domains/terms-compliance/terms-compliance.service"
import { UserGuard } from "@/domains/users/user.guard"
import { toDto as toOrganizationDto } from "../organizations/organization.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectsService } from "../projects/projects.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { MeService } from "./me.service"

@UseGuards(JwtAuthGuard, UserGuard)
@Controller()
export class MeController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly meService: MeService,
    private readonly projectsService: ProjectsService,
    private readonly termsComplianceService: TermsComplianceService,
  ) {}

  @Get(MeRoutes.getMe.path)
  async getMe(@Req() request: EndpointRequest): Promise<typeof MeRoutes.getMe.response> {
    const user = request.user
    const [organizations, memberships, termsDocuments, latestAcceptance] = await Promise.all([
      this.organizationsService.getUserOrganizations(user.id),
      this.meService.getUserMemberships(user.id),
      this.termsComplianceService.listTermsDocuments(),
      this.termsComplianceService.getLatestAcceptanceForUser(user.id),
    ])
    const organizationsWithProjects = await Promise.all(
      organizations.map(async (org) => {
        const projects = await this.projectsService.listProjects({
          organizationId: org.id,
          userId: user.id,
        })
        return {
          ...org,
          projects,
        }
      }),
    )
    return {
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name ?? buildNameFromEmail(user.email),
          memberships: toUserMembershipDto(memberships),
          isBackofficeAuthorized: isDomainBackofficeAuthorized(user.email),
          isTermsManagementAuthorized: isEmailBackofficeAuthorized(user.email),
          termsAccepted: isAcceptanceUpToDate(latestAcceptance, termsDocuments),
        },
        organizations: organizationsWithProjects.map(toOrganizationDto),
        currentTerms: toCurrentTermsDto(termsDocuments),
      },
    }
  }

  @Get(MeRoutes.getPendingInvitations.path)
  async getPendingInvitations(
    @Req() request: EndpointRequest,
  ): Promise<typeof MeRoutes.getPendingInvitations.response> {
    const { projectInvitations, agentInvitations } = await this.meService.getPendingInvitations(
      request.user.id,
    )
    return {
      data: {
        projectInvitations: projectInvitations.map(toPendingProjectInvitationDto),
        agentInvitations: agentInvitations.map(toPendingAgentInvitationDto),
      },
    }
  }
}

function toPendingProjectInvitationDto(
  membership: Awaited<ReturnType<MeService["getPendingInvitations"]>>["projectInvitations"][number],
): PendingProjectInvitationDto {
  return {
    id: membership.id,
    projectId: membership.projectId,
    projectName: membership.project.name,
    organizationId: membership.project.organizationId,
    organizationName: membership.project.organization.name,
    role: membership.role,
    invitationToken: membership.invitationToken,
    createdAt: membership.createdAt.getTime(),
  }
}

function toPendingAgentInvitationDto(
  membership: Awaited<ReturnType<MeService["getPendingInvitations"]>>["agentInvitations"][number],
): PendingAgentInvitationDto {
  return {
    id: membership.id,
    agentId: membership.agentId,
    agentName: membership.agent.name,
    projectId: membership.agent.project.id,
    projectName: membership.agent.project.name,
    organizationId: membership.agent.project.organizationId,
    organizationName: membership.agent.project.organization.name,
    role: membership.role,
    invitationToken: membership.invitationToken,
    createdAt: membership.createdAt.getTime(),
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
