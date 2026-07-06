import { randomUUID } from "node:crypto"
import { Inject, Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { EntityManager, Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import {
  INVITATION_SENDER,
  type InvitationSender,
} from "@/domains/auth/invitation-sender.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationPersistenceService } from "@/domains/invitations/invitation-persistence.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
import { Project } from "@/domains/projects/project.entity"
import { User } from "@/domains/users/user.entity"
import { Invitation } from "../invitation.entity"
import type {
  InvitationAcceptanceHandler,
  InvitationAcceptanceType,
} from "./invitation-acceptance.handler"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationAcceptanceHelpersService } from "./invitation-acceptance-helpers.service"
import type { BaseInviteMembersContext } from "./invitation-handler.types"
import type {
  CreateInvitationsForTargetParams,
  InvitationTargetHandler,
  InvitationTargetScope,
} from "./invitation-target.handler"

type InviteMembersContext = BaseInviteMembersContext & {
  projectMembershipRepository: Repository<ProjectMembership>
  projectOrganizationId: string
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
    private readonly transactionService: TransactionService,
    private readonly invitationPersistence: InvitationPersistenceService,
    private readonly projectMembershipsService: ProjectMembershipsService,
    private readonly organizationMembershipsService: OrganizationMembershipsService,
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
    return this.transactionService.run(async () => {
      const manager = this.transactionService.getManager()
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
    return this.transactionService.run(async () => {
      const manager = this.transactionService.getManager()
      const invitationRepository = manager.getRepository(Invitation)
      const userRepository = manager.getRepository(User)

      const invitation = await this.acceptanceHelpers.findAndValidateInvitation(
        invitationRepository,
        params.ticketId,
        params.email,
        this.targetType,
      )
      const project = await this.projectRepository.findOneOrFail({
        where: { id: invitation.projectId },
      })
      const user = await this.acceptanceHelpers.resolveAcceptedUser(
        userRepository,
        params.auth0Sub,
        params.email,
      )

      await this.organizationMembershipsService.upsertOrganizationAdminMembership({
        userId: user.id,
        organizationId: project.organizationId,
      })
      await this.projectMembershipsService.upsertProjectAdminMembership({
        userId: user.id,
        projectId: invitation.projectId,
      })
      await invitationRepository.update({ id: invitation.id }, { userId: user.id })

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
    context: InviteMembersContext
  }): Promise<boolean> {
    if (params.existingUser) {
      const existingMembership = await params.context.projectMembershipRepository.findOne({
        where: { projectId: params.projectId, userId: params.existingUser.id },
      })
      if (existingMembership) {
        await this.projectMembershipsService.upsertProjectAdminMembership({
          userId: params.existingUser.id,
          projectId: params.projectId,
        })
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
}
