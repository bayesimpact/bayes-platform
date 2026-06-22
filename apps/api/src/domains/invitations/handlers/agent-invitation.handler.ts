import { randomUUID } from "node:crypto"
import { Inject, Injectable, NotFoundException } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource, In, type Repository } from "typeorm"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentMembership } from "@/domains/agents/memberships/agent-membership.entity"
import {
  INVITATION_SENDER,
  type InvitationSender,
} from "@/domains/auth/invitation-sender.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationPersistenceService } from "@/domains/invitations/invitation-persistence.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import {
  type UserMembershipRole,
  UserMembershipService,
} from "@/domains/memberships/user-membership.service"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
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
  membershipRepository: Repository<AgentMembership>
  agentOrganizationId: string
  agentProjectId: string
}

type AcceptanceRepositories = BaseAcceptanceRepositories & {
  agentRepository: Repository<Agent>
  membershipRepository: Repository<AgentMembership>
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
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly invitationPersistence: InvitationPersistenceService,
    private readonly acceptanceHelpers: InvitationAcceptanceHelpersService,
    private readonly userMembershipService: UserMembershipService,
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
    return this.dataSource.transaction(async (manager) => {
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
    return this.dataSource.transaction(async (manager) => {
      const repos: AcceptanceRepositories = {
        agentRepository: manager.getRepository(Agent),
        invitationRepository: manager.getRepository(Invitation),
        membershipRepository: manager.getRepository(AgentMembership),
        organizationMembershipRepository: manager.getRepository(OrganizationMembership),
        projectMembershipRepository: manager.getRepository(ProjectMembership),
        userRepository: manager.getRepository(User),
      }

      const invitation = await this.acceptanceHelpers.findAndValidateInvitation(
        repos.invitationRepository,
        params.ticketId,
        params.email,
        this.targetType,
      )
      const user = await this.acceptanceHelpers.resolveAcceptedUser(
        repos.userRepository,
        params.auth0Sub,
        params.email,
      )
      const agent = await repos.agentRepository.findOneOrFail({
        where: { id: invitation.targetId },
      })

      await this.acceptanceHelpers.ensureOrganizationMembership(
        repos.organizationMembershipRepository,
        user.id,
        agent.organizationId,
      )
      await this.userMembershipService.upsertOrganizationMembership(
        { userId: user.id, organizationId: agent.organizationId, role: "member" },
        manager,
      )
      await this.acceptanceHelpers.ensureProjectMembership(
        repos.projectMembershipRepository,
        user.id,
        agent.projectId,
      )
      await this.userMembershipService.upsertProjectMembership(
        { userId: user.id, projectId: agent.projectId, role: "member" },
        manager,
      )

      const existingMembership = await repos.membershipRepository.findOne({
        where: { agentId: invitation.targetId, userId: user.id },
      })
      if (!existingMembership) {
        await repos.membershipRepository.save(
          repos.membershipRepository.create({
            agentId: invitation.targetId,
            userId: user.id,
            role: invitation.role as AgentMembership["role"],
          }),
        )
        await this.userMembershipService.upsertAgentMembership(
          {
            userId: user.id,
            agentId: invitation.targetId,
            role: invitation.role as UserMembershipRole,
          },
          manager,
        )
      }
      await repos.invitationRepository.update({ id: invitation.id }, { userId: user.id })
      return { userId: user.id }
    })
  }
}
