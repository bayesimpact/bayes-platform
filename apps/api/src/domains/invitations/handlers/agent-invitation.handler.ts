import { randomUUID } from "node:crypto"
import { Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
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
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { User } from "@/domains/users/user.entity"
import { Invitation } from "../invitation.entity"
import type {
  InvitationAcceptanceHandler,
  InvitationAcceptanceType,
} from "./invitation-acceptance.handler"
import type {
  CreateInvitationsForTargetParams,
  InvitationTargetHandler,
  InvitationTargetScope,
} from "./invitation-target.handler"

type InviteMembersContext = {
  userRepository: Repository<User>
  membershipRepository: Repository<AgentMembership>
  invitationRepository: Repository<Invitation>
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
    private readonly dataSource: DataSource,
    private readonly invitationPersistence: InvitationPersistenceService,
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

    const { ticketId } = await this.invitationSender.sendInvitation({
      inviteeEmail: normalizedEmail,
      inviterName: params.inviterName,
    })
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
      const membershipRepository = manager.getRepository(AgentMembership)
      const userRepository = manager.getRepository(User)
      const invitationRepository = manager.getRepository(Invitation)
      const organizationMembershipRepository = manager.getRepository(OrganizationMembership)
      const projectMembershipRepository = manager.getRepository(ProjectMembership)
      const agentRepository = manager.getRepository(Agent)

      const invitation = await invitationRepository.findOne({
        where: { invitationToken: params.ticketId, targetType: "agent" },
      })
      if (!invitation)
        throw new NotFoundException(`Invitation not found for ticket: ${params.ticketId}`)
      if (
        invitation.invitedEmail &&
        invitation.invitedEmail.trim().toLowerCase() !== params.email.trim().toLowerCase()
      ) {
        throw new UnauthorizedException(`No invitation found for email: ${params.email}`)
      }
      const user = await this.resolveAcceptedUser({
        userRepository,
        auth0Sub: params.auth0Sub,
        email: params.email,
      })
      const agent = await agentRepository.findOneOrFail({ where: { id: invitation.targetId } })
      await this.ensureOrganizationMembership({
        organizationMembershipRepository,
        userId: user.id,
        organizationId: agent.organizationId,
      })
      await this.ensureProjectMembership({
        projectMembershipRepository,
        userId: user.id,
        projectId: agent.projectId,
      })
      const existingMembership = await membershipRepository.findOne({
        where: { agentId: invitation.targetId, userId: user.id },
      })
      if (!existingMembership) {
        const membership = membershipRepository.create({
          agentId: invitation.targetId,
          userId: user.id,
          invitationToken: `accepted-agent-invitation-${randomUUID()}`,
          role: invitation.role as AgentMembership["role"],
        })
        await membershipRepository.save(membership)
      }
      await invitationRepository.update({ id: invitation.id }, { userId: user.id })
      return { userId: user.id }
    })
  }

  private async resolveAcceptedUser(params: {
    userRepository: Repository<User>
    auth0Sub: string
    email: string
  }): Promise<User> {
    const normalizedEmail = params.email.trim().toLowerCase()
    const byAuth0Id = await params.userRepository.findOne({ where: { auth0Id: params.auth0Sub } })
    if (byAuth0Id) return byAuth0Id
    const byEmail = await params.userRepository.findOne({ where: { email: normalizedEmail } })
    if (byEmail) {
      if (byEmail.auth0Id !== params.auth0Sub) {
        byEmail.auth0Id = params.auth0Sub
        return params.userRepository.save(byEmail)
      }
      return byEmail
    }
    const user = params.userRepository.create({
      auth0Id: params.auth0Sub,
      email: normalizedEmail,
      name: null,
      pictureUrl: null,
    })
    return params.userRepository.save(user)
  }

  private async ensureProjectMembership(params: {
    projectMembershipRepository: Repository<ProjectMembership>
    userId: string
    projectId: string
  }): Promise<void> {
    const existingMembership = await params.projectMembershipRepository.findOne({
      where: { userId: params.userId, projectId: params.projectId },
    })
    if (existingMembership) return
    const membership = params.projectMembershipRepository.create({
      userId: params.userId,
      projectId: params.projectId,
      invitationToken: randomUUID(),
      role: "member",
    })
    await params.projectMembershipRepository.save(membership)
  }

  private async ensureOrganizationMembership(params: {
    organizationMembershipRepository: Repository<OrganizationMembership>
    userId: string
    organizationId: string
  }): Promise<void> {
    const existingMembership = await params.organizationMembershipRepository.findOne({
      where: { userId: params.userId, organizationId: params.organizationId },
    })
    if (existingMembership) return
    const membership = params.organizationMembershipRepository.create({
      userId: params.userId,
      organizationId: params.organizationId,
      role: "member",
    })
    await params.organizationMembershipRepository.save(membership)
  }
}
