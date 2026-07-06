import { randomUUID } from "node:crypto"
import { Inject, Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentMembership } from "@/domains/agents/memberships/agent-membership.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
import {
  INVITATION_SENDER,
  type InvitationSender,
} from "@/domains/auth/invitation-sender.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationPersistenceService } from "@/domains/invitations/invitation-persistence.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipService } from "@/domains/organizations/memberships/organization-membership.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
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
  membershipRepository: Repository<AgentMembership>
  agentOrganizationId: string
  agentProjectId: string
}

@Injectable()
export class AgentInvitationHandler
  implements InvitationTargetHandler, InvitationAcceptanceHandler
{
  readonly targetType = "agent" as const
  readonly acceptanceType: InvitationAcceptanceType = "agent"

  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(AgentMembership)
    readonly _agentMembershipRepository: Repository<AgentMembership>,
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
    @Inject(INVITATION_SENDER)
    private readonly invitationSender: InvitationSender,
    private readonly transactionService: TransactionService,
    private readonly invitationPersistence: InvitationPersistenceService,
    private readonly acceptanceHelpers: InvitationAcceptanceHelpersService,
    private readonly organizationMembershipService: OrganizationMembershipService,
    private readonly projectMembershipsService: ProjectMembershipsService,
    private readonly agentMembershipsService: AgentMembershipsService,
  ) {}

  async createInvitations(params: CreateInvitationsForTargetParams): Promise<Invitation[]> {
    return this.inviteMembers({
      agentId: params.targetId,
      emails: params.emails,
      inviterName: params.inviterName,
    })
  }

  async inviteMembers(params: {
    agentId: string
    emails: string[]
    inviterName: string
  }): Promise<Invitation[]> {
    return this.transactionService.run(async () => {
      const manager = this.transactionService.getManager()
      const context: InviteMembersContext = {
        userRepository: manager.getRepository(User),
        membershipRepository: manager.getRepository(AgentMembership),
        invitationRepository: manager.getRepository(Invitation),
        agentOrganizationId: "",
        agentProjectId: "",
      }
      const agent = await manager.getRepository(Agent).findOneOrFail({
        where: { id: params.agentId },
        select: { id: true, organizationId: true, projectId: true },
      })
      context.agentOrganizationId = agent.organizationId
      context.agentProjectId = agent.projectId
      const createdInvitations: Invitation[] = []

      for (const email of params.emails) {
        const invitation = await this.inviteOneMember({
          email,
          agentId: params.agentId,
          inviterName: params.inviterName,
          manager,
          context,
        })
        if (invitation) createdInvitations.push(invitation)
      }

      return createdInvitations
    })
  }

  private async inviteOneMember(params: {
    email: string
    agentId: string
    inviterName: string
    manager: Parameters<InvitationPersistenceService["createPendingAgentInvitation"]>[1]
    context: InviteMembersContext
  }): Promise<Invitation | null> {
    const normalizedEmail = params.email.trim().toLowerCase()
    if (!normalizedEmail) return null

    const existingUser = await params.context.userRepository.findOne({
      where: { email: normalizedEmail },
    })
    if (
      await this.shouldSkipInvitation({
        existingUser,
        normalizedEmail,
        agentId: params.agentId,
        context: params.context,
      })
    ) {
      return null
    }

    const ticketId = existingUser
      ? randomUUID()
      : (
          await this.invitationSender.sendInvitation({
            inviteeEmail: normalizedEmail,
            inviterName: params.inviterName,
          })
        ).ticketId
    return this.invitationPersistence.createPendingAgentInvitation(
      {
        organizationId: params.context.agentOrganizationId,
        projectId: params.context.agentProjectId,
        agentId: params.agentId,
        userId: existingUser?.id ?? null,
        invitedEmail: normalizedEmail,
        invitationToken: ticketId,
        role: "member",
      },
      params.manager,
    )
  }

  private async shouldSkipInvitation(params: {
    existingUser: User | null
    normalizedEmail: string
    agentId: string
    context: InviteMembersContext
  }): Promise<boolean> {
    if (params.existingUser) {
      const existingMembership = await params.context.membershipRepository.findOne({
        where: { agentId: params.agentId, userId: params.existingUser.id },
      })
      if (existingMembership) return true
    }

    const existingPendingInvitation = await params.context.invitationRepository.findOne({
      where: {
        targetType: "agent",
        targetId: params.agentId,
        invitedEmail: params.normalizedEmail,
        status: "pending",
      },
      select: { id: true },
    })
    return !!existingPendingInvitation
  }

  async resolveScope(targetId: string): Promise<InvitationTargetScope> {
    const agent = await this.agentRepository.findOne({ where: { id: targetId } })
    if (!agent) {
      throw new NotFoundException(`Agent ${targetId} not found`)
    }
    return { organizationId: agent.organizationId, projectId: agent.projectId }
  }

  async resolveTargetNameByInvitationId(invitations: Invitation[]): Promise<Map<string, string>> {
    const agentIds = [...new Set(invitations.map((invitation) => invitation.targetId))]
    if (agentIds.length === 0) return new Map<string, string>()

    const agents = await this.agentRepository.find({
      where: { id: In(agentIds) },
      select: { id: true, name: true },
    })
    const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name]))

    const targetNameByInvitationId = new Map<string, string>()
    for (const invitation of invitations) {
      targetNameByInvitationId.set(invitation.id, agentNameById.get(invitation.targetId) ?? "")
    }
    return targetNameByInvitationId
  }

  async canHandle(ticketId: string): Promise<boolean> {
    const invitation = await this.invitationRepository.findOne({
      where: { invitationToken: ticketId, targetType: "agent" },
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
      const user = await this.acceptanceHelpers.resolveAcceptedUser(
        userRepository,
        params.auth0Sub,
        params.email,
      )
      const agent = await this.agentRepository.findOneOrFail({
        where: { id: invitation.targetId },
      })

      await this.organizationMembershipService.upsertOrganizationMemberMembership({
        userId: user.id,
        organizationId: agent.organizationId,
      })
      await this.projectMembershipsService.upsertProjectMemberMembership({
        userId: user.id,
        projectId: agent.projectId,
      })
      await this.agentMembershipsService.upsertAgentMemberMembership({
        userId: user.id,
        agentId: invitation.targetId,
        role: invitation.role as AgentMembership["role"],
      })
      await invitationRepository.update({ id: invitation.id }, { userId: user.id })

      return { userId: user.id }
    })
  }
}
