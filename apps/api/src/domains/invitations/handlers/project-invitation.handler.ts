import { randomUUID } from "node:crypto"
import { Inject, Injectable, NotFoundException } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
import type { EntityManager, Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
import {
  INVITATION_SENDER,
  type InvitationSender,
} from "@/domains/auth/invitation-sender.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationPersistenceService } from "@/domains/invitations/invitation-persistence.service"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { Project } from "@/domains/projects/project.entity"
import { User } from "@/domains/users/user.entity"
import { Invitation } from "../invitation.entity"
import type {
  InvitationAcceptanceHandler,
  InvitationAcceptanceType,
} from "./invitation-acceptance.handler"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationAcceptanceHelpersService } from "./invitation-acceptance-helpers.service"
import type {
  BaseAcceptanceRepositories,
  BaseInviteMembersContext,
} from "./invitation-handler.types"
import type {
  CreateInvitationsForTargetParams,
  InvitationTargetHandler,
  InvitationTargetScope,
} from "./invitation-target.handler"

type InviteMembersContext = BaseInviteMembersContext & {
  projectMembershipRepository: Repository<ProjectMembership>
  projectOrganizationId: string
}

type AcceptanceRepositories = BaseAcceptanceRepositories & {
  projectRepository: Repository<Project>
}

@Injectable()
export class ProjectInvitationHandler
  implements InvitationTargetHandler, InvitationAcceptanceHandler
{
  readonly targetType = "project" as const
  readonly acceptanceType: InvitationAcceptanceType = "project"

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectMembership)
    readonly _projectMembershipRepository: Repository<ProjectMembership>,
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
    @Inject(INVITATION_SENDER)
    private readonly invitationSender: InvitationSender,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly invitationPersistence: InvitationPersistenceService,
    private readonly agentMembershipsService: AgentMembershipsService,
    private readonly acceptanceHelpers: InvitationAcceptanceHelpersService,
  ) {}

  async createInvitations(params: CreateInvitationsForTargetParams): Promise<Invitation[]> {
    return this.inviteMembers({
      projectId: params.targetId,
      emails: params.emails,
      inviterName: params.inviterName,
    })
  }

  async inviteMembers(params: {
    projectId: string
    emails: string[]
    inviterName: string
  }): Promise<Invitation[]> {
    return this.dataSource.transaction(async (manager) => {
      const context = await this.buildInviteMembersContext(manager, params.projectId)
      const invitations: Invitation[] = []
      for (const email of params.emails) {
        const invitation = await this.inviteOneMember({
          email,
          inviterName: params.inviterName,
          projectId: params.projectId,
          manager,
          context,
        })
        if (invitation) invitations.push(invitation)
      }
      return invitations
    })
  }

  async resolveScope(targetId: string): Promise<InvitationTargetScope> {
    const project = await this.projectRepository.findOne({ where: { id: targetId } })
    if (!project) {
      throw new NotFoundException(`Project ${targetId} not found`)
    }
    return { organizationId: project.organizationId, projectId: project.id }
  }

  async resolveTargetNameByInvitationId(invitations: Invitation[]): Promise<Map<string, string>> {
    const targetNameByInvitationId = new Map<string, string>()
    for (const invitation of invitations) {
      targetNameByInvitationId.set(invitation.id, "")
    }
    return targetNameByInvitationId
  }

  async canHandle(ticketId: string): Promise<boolean> {
    const invitation = await this.invitationRepository.findOne({
      where: { invitationToken: ticketId, targetType: "project" },
      select: { id: true },
    })
    return !!invitation
  }

  async acceptInvitation(params: {
    ticketId: string
    auth0Sub: string
    email: string
  }): Promise<{ userId: string }> {
    return this.dataSource.transaction(async (manager) => {
      const repos: AcceptanceRepositories = {
        invitationRepository: manager.getRepository(Invitation),
        organizationMembershipRepository: manager.getRepository(OrganizationMembership),
        projectMembershipRepository: manager.getRepository(ProjectMembership),
        projectRepository: manager.getRepository(Project),
        userRepository: manager.getRepository(User),
      }

      const invitation = await this.acceptanceHelpers.findAndValidateInvitation(
        repos.invitationRepository,
        params.ticketId,
        params.email,
        this.targetType,
      )
      const project = await repos.projectRepository.findOneOrFail({
        where: { id: invitation.projectId },
      })
      const user = await this.acceptanceHelpers.resolveAcceptedUser(
        repos.userRepository,
        params.auth0Sub,
        params.email,
      )

      await this.acceptanceHelpers.ensureOrganizationMembership(
        repos.organizationMembershipRepository,
        user.id,
        project.organizationId,
        "admin",
      )
      await this.acceptanceHelpers.ensureProjectMembership(
        repos.projectMembershipRepository,
        user.id,
        invitation.projectId,
        "admin",
      )
      await this.agentMembershipsService.createAdminAgentMembershipsForUserInProject({
        manager,
        userId: user.id,
        projectId: project.id,
      })
      await repos.invitationRepository.update({ id: invitation.id }, { userId: user.id })

      return { userId: user.id }
    })
  }

  private async buildInviteMembersContext(
    manager: EntityManager,
    projectId: string,
  ): Promise<InviteMembersContext> {
    const project = await manager.getRepository(Project).findOneOrFail({
      where: { id: projectId },
      select: { id: true, organizationId: true },
    })
    return {
      userRepository: manager.getRepository(User),
      projectMembershipRepository: manager.getRepository(ProjectMembership),
      invitationRepository: manager.getRepository(Invitation),
      projectOrganizationId: project.organizationId,
    }
  }

  private async inviteOneMember(params: {
    email: string
    inviterName: string
    projectId: string
    manager: EntityManager
    context: InviteMembersContext
  }): Promise<Invitation | null> {
    const normalizedEmail = params.email.trim().toLowerCase()
    if (!normalizedEmail) return null

    const existingUser = await params.context.userRepository.findOne({
      where: { email: normalizedEmail },
    })
    const shouldSkip = await this.shouldSkipInvitation({
      existingUser,
      normalizedEmail,
      projectId: params.projectId,
      manager: params.manager,
      context: params.context,
    })
    if (shouldSkip) return null

    const ticketId = existingUser
      ? randomUUID()
      : (
          await this.invitationSender.sendInvitation({
            inviteeEmail: normalizedEmail,
            inviterName: params.inviterName,
          })
        ).ticketId
    return this.invitationPersistence.createPendingProjectInvitation(
      {
        organizationId: params.context.projectOrganizationId,
        projectId: params.projectId,
        userId: existingUser?.id ?? null,
        invitedEmail: normalizedEmail,
        invitationToken: ticketId,
        role: "admin",
      },
      params.manager,
    )
  }

  private async shouldSkipInvitation(params: {
    existingUser: User | null
    normalizedEmail: string
    projectId: string
    manager: EntityManager
    context: InviteMembersContext
  }): Promise<boolean> {
    if (params.existingUser) {
      const existingMembership = await params.context.projectMembershipRepository.findOne({
        where: { projectId: params.projectId, userId: params.existingUser.id },
      })
      if (existingMembership) {
        await this.promoteToAdminIfNeeded(
          params.context.projectMembershipRepository,
          existingMembership,
          params.existingUser.id,
          params.projectId,
          params.manager,
        )
        return true
      }
    }

    const existingPendingInvitation = await params.context.invitationRepository.findOne({
      where: {
        targetType: "project",
        targetId: params.projectId,
        invitedEmail: params.normalizedEmail,
        status: "pending",
      },
      select: { id: true },
    })
    return !!existingPendingInvitation
  }

  private async promoteToAdminIfNeeded(
    repository: Repository<ProjectMembership>,
    membership: ProjectMembership,
    userId: string,
    projectId: string,
    manager: EntityManager,
  ): Promise<void> {
    if (membership.role === "admin") return

    membership.role = "admin"
    await repository.save(membership)
    await this.agentMembershipsService.createAdminAgentMembershipsForUserInProject({
      manager,
      userId,
      projectId,
    })
  }
}
