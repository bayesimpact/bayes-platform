import { Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
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
import type {
  CreateInvitationsForTargetParams,
  InvitationTargetHandler,
  InvitationTargetScope,
} from "./invitation-target.handler"

type InviteMembersContext = {
  invitationRepository: Repository<Invitation>
  projectMembershipRepository: Repository<ProjectMembership>
  projectOrganizationId: string
  userRepository: Repository<User>
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
    private readonly dataSource: DataSource,
    private readonly invitationPersistence: InvitationPersistenceService,
    private readonly agentMembershipsService: AgentMembershipsService,
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
      const context = await this.buildInviteMembersContext({
        manager,
        projectId: params.projectId,
      })
      return this.collectInvitationsForEmails({
        emails: params.emails,
        inviterName: params.inviterName,
        projectId: params.projectId,
        manager,
        context,
      })
    })
  }

  private async buildInviteMembersContext(params: {
    manager: Parameters<
      AgentMembershipsService["createAdminAgentMembershipsForUserInProject"]
    >[0]["manager"]
    projectId: string
  }): Promise<InviteMembersContext> {
    const context: InviteMembersContext = {
      userRepository: params.manager.getRepository(User),
      projectMembershipRepository: params.manager.getRepository(ProjectMembership),
      invitationRepository: params.manager.getRepository(Invitation),
      projectOrganizationId: "",
    }
    const project = await params.manager.getRepository(Project).findOneOrFail({
      where: { id: params.projectId },
      select: { id: true, organizationId: true },
    })
    context.projectOrganizationId = project.organizationId
    return context
  }

  private async collectInvitationsForEmails(params: {
    emails: string[]
    inviterName: string
    projectId: string
    manager: Parameters<
      AgentMembershipsService["createAdminAgentMembershipsForUserInProject"]
    >[0]["manager"]
    context: InviteMembersContext
  }): Promise<Invitation[]> {
    const createdInvitations: Invitation[] = []
    for (const email of params.emails) {
      const invitation = await this.inviteOneMember({
        email,
        inviterName: params.inviterName,
        projectId: params.projectId,
        manager: params.manager,
        context: params.context,
      })
      if (invitation) {
        createdInvitations.push(invitation)
      }
    }
    return createdInvitations
  }

  private async inviteOneMember(params: {
    email: string
    inviterName: string
    projectId: string
    manager: Parameters<
      AgentMembershipsService["createAdminAgentMembershipsForUserInProject"]
    >[0]["manager"]
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

    const { ticketId } = await this.invitationSender.sendInvitation({
      inviteeEmail: normalizedEmail,
      inviterName: params.inviterName,
    })
    return this.createPendingProjectInvitation({
      existingUser,
      normalizedEmail,
      ticketId,
      projectId: params.projectId,
      manager: params.manager,
      context: params.context,
    })
  }

  private async shouldSkipInvitation(params: {
    existingUser: User | null
    normalizedEmail: string
    projectId: string
    manager: Parameters<
      AgentMembershipsService["createAdminAgentMembershipsForUserInProject"]
    >[0]["manager"]
    context: InviteMembersContext
  }): Promise<boolean> {
    if (params.existingUser) {
      const existingMembership = await params.context.projectMembershipRepository.findOne({
        where: { projectId: params.projectId, userId: params.existingUser.id },
      })
      if (existingMembership) {
        await this.promoteExistingMembershipToAdminIfNeeded({
          existingMembership,
          userId: params.existingUser.id,
          projectId: params.projectId,
          manager: params.manager,
          projectMembershipRepository: params.context.projectMembershipRepository,
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

  private async promoteExistingMembershipToAdminIfNeeded(params: {
    existingMembership: ProjectMembership
    userId: string
    projectId: string
    manager: Parameters<
      AgentMembershipsService["createAdminAgentMembershipsForUserInProject"]
    >[0]["manager"]
    projectMembershipRepository: Repository<ProjectMembership>
  }): Promise<void> {
    if (params.existingMembership.role === "admin") return

    params.existingMembership.role = "admin"
    await params.projectMembershipRepository.save(params.existingMembership)
    await this.agentMembershipsService.createAdminAgentMembershipsForUserInProject({
      manager: params.manager,
      userId: params.userId,
      projectId: params.projectId,
    })
  }

  private async createPendingProjectInvitation(params: {
    existingUser: User | null
    normalizedEmail: string
    ticketId: string
    projectId: string
    manager: Parameters<
      AgentMembershipsService["createAdminAgentMembershipsForUserInProject"]
    >[0]["manager"]
    context: InviteMembersContext
  }): Promise<Invitation> {
    return this.invitationPersistence.createPendingProjectInvitation(
      {
        organizationId: params.context.projectOrganizationId,
        projectId: params.projectId,
        userId: params.existingUser?.id ?? null,
        invitedEmail: params.normalizedEmail,
        invitationToken: params.ticketId,
        role: "admin",
      },
      params.manager,
    )
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
      const projectMembershipRepository = manager.getRepository(ProjectMembership)
      const userRepository = manager.getRepository(User)
      const invitationRepository = manager.getRepository(Invitation)
      const organizationMembershipRepository = manager.getRepository(OrganizationMembership)
      const projectRepository = manager.getRepository(Project)

      const invitation = await invitationRepository.findOne({
        where: { invitationToken: params.ticketId, targetType: "project" },
      })
      if (!invitation) {
        throw new NotFoundException(`Invitation not found for ticket: ${params.ticketId}`)
      }
      if (
        invitation.invitedEmail &&
        invitation.invitedEmail.trim().toLowerCase() !== params.email.trim().toLowerCase()
      ) {
        throw new UnauthorizedException(`No invitation found for email: ${params.email}`)
      }
      const project = await projectRepository.findOneOrFail({ where: { id: invitation.projectId } })
      const user = await this.resolveAcceptedUser({
        userRepository,
        auth0Sub: params.auth0Sub,
        email: params.email,
      })
      await this.ensureOrganizationMembership({
        organizationMembershipRepository,
        userId: user.id,
        organizationId: project.organizationId,
      })
      const existingMembership = await projectMembershipRepository.findOne({
        where: { projectId: invitation.projectId, userId: user.id },
      })
      if (existingMembership) {
        if (existingMembership.role !== "admin") {
          existingMembership.role = "admin"
          await projectMembershipRepository.save(existingMembership)
        }
      } else {
        const membership = projectMembershipRepository.create({
          projectId: invitation.projectId,
          userId: user.id,
          role: "admin",
        })
        await projectMembershipRepository.save(membership)
      }
      await this.agentMembershipsService.createAdminAgentMembershipsForUserInProject({
        manager,
        userId: user.id,
        projectId: project.id,
      })
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

  private async ensureOrganizationMembership(params: {
    organizationMembershipRepository: Repository<OrganizationMembership>
    userId: string
    organizationId: string
  }): Promise<void> {
    const existingMembership = await params.organizationMembershipRepository.findOne({
      where: { userId: params.userId, organizationId: params.organizationId },
    })
    if (existingMembership) {
      if (existingMembership.role === "member") {
        existingMembership.role = "admin"
        await params.organizationMembershipRepository.save(existingMembership)
      }
      return
    }
    const membership = params.organizationMembershipRepository.create({
      userId: params.userId,
      organizationId: params.organizationId,
      role: "admin",
    })
    await params.organizationMembershipRepository.save(membership)
  }
}
