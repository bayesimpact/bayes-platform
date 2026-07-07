import { randomUUID } from "node:crypto"
import type { DataSource, Repository } from "typeorm"
import type { InvitationSender } from "@/domains/auth/invitation-sender.interface"
import { Invitation } from "@/domains/invitations/invitation.entity"
import type { UserMembershipService } from "@/domains/memberships/user-membership.service"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { PLACEHOLDER_AUTH0_ID_PREFIX } from "@/domains/projects/memberships/project-memberships.service"
import { Project } from "@/domains/projects/project.entity"
import { User } from "@/domains/users/user.entity"

export type InviteWorkspaceOwnerInput = {
  email: string
  organizationName: string
  workspaceName?: string | null
  inviterName: string
  fullName?: string | null
}

export type InviteWorkspaceOwnerResult = {
  status: "invited" | "skipped_existing_membership"
  email: string
  organizationName: string
  organizationId: string
  projectId: string
  userId: string
  message: string
}

export type PreviewWorkspaceInvitationResult = {
  status: "would_invite" | "would_skip_existing_membership"
  email: string
  organizationName: string
}

export class WorkspaceInvitationService {
  constructor(
    private readonly invitationSender: InvitationSender,
    private readonly dataSource: DataSource,
    private readonly userMembershipService: UserMembershipService,
  ) {}

  async inviteWorkspaceOwner(
    input: InviteWorkspaceOwnerInput,
  ): Promise<InviteWorkspaceOwnerResult> {
    const normalizedEmail = input.email.trim().toLowerCase()
    const normalizedOrgName = input.organizationName.trim()
    const projectName = input.workspaceName?.trim() || normalizedOrgName

    return this.dataSource.transaction(async (manager) => {
      const organizationRepository = manager.getRepository(Organization)
      const organizationMembershipRepository = manager.getRepository(OrganizationMembership)
      const projectRepository = manager.getRepository(Project)
      const projectMembershipRepository = manager.getRepository(ProjectMembership)
      const userRepository = manager.getRepository(User)

      const organization = await this.findOrCreateOrganization({
        organizationName: normalizedOrgName,
        organizationRepository,
      })

      const user = await this.findOrCreatePlaceholderUser({
        email: normalizedEmail,
        fullName: input.fullName,
        userRepository,
      })

      const existingProjectMembership = await this.findExistingProjectMembershipInOrganization({
        userId: user.id,
        organizationId: organization.id,
        projectMembershipRepository,
        projectRepository,
      })

      if (existingProjectMembership) {
        return {
          status: "skipped_existing_membership" as const,
          email: normalizedEmail,
          organizationName: normalizedOrgName,
          organizationId: organization.id,
          projectId: existingProjectMembership.projectId,
          userId: user.id,
          message: "User already has a project membership in this organization.",
        }
      }

      const project = await this.findOrCreateDefaultProject({
        organizationId: organization.id,
        projectName,
        projectRepository,
      })

      // Ensure org membership exists for the user
      const existingOrgMembership = await organizationMembershipRepository.findOne({
        where: { userId: user.id, organizationId: organization.id },
      })
      if (!existingOrgMembership) {
        await organizationMembershipRepository.save(
          organizationMembershipRepository.create({
            userId: user.id,
            organizationId: organization.id,
            role: "admin",
          }),
        )
        await this.userMembershipService.upsertOrganizationMembership(
          { userId: user.id, organizationId: organization.id, role: "admin" },
          manager,
        )
      }

      const { ticketId } = await this.invitationSender.sendInvitation({
        inviteeEmail: normalizedEmail,
        inviterName: input.inviterName,
      })

      const invitationRepository = manager.getRepository(Invitation)
      await invitationRepository.save(
        invitationRepository.create({
          organizationId: organization.id,
          projectId: project.id,
          targetType: "project",
          targetId: project.id,
          userId: user.id,
          invitedEmail: user.email,
          invitationToken: ticketId,
          status: "pending",
          role: "admin",
          invitedAt: new Date(),
          acceptedAt: null,
        }),
      )

      return {
        status: "invited" as const,
        email: normalizedEmail,
        organizationName: normalizedOrgName,
        organizationId: organization.id,
        projectId: project.id,
        userId: user.id,
        message: "Invitation sent.",
      }
    })
  }

  async previewInvitation(input: {
    email: string
    organizationName: string
  }): Promise<PreviewWorkspaceInvitationResult> {
    const normalizedEmail = input.email.trim().toLowerCase()
    const normalizedOrgName = input.organizationName.trim()

    const userRepository = this.dataSource.getRepository(User)
    const projectMembershipRepository = this.dataSource.getRepository(ProjectMembership)
    const projectRepository = this.dataSource.getRepository(Project)

    const user = await userRepository.findOne({ where: { email: normalizedEmail } })

    if (user) {
      const organization = await this.dataSource
        .getRepository(Organization)
        .createQueryBuilder("organization")
        .where("LOWER(organization.name) = LOWER(:name)", { name: normalizedOrgName })
        .getOne()

      if (organization) {
        const existingProjectMembership = await this.findExistingProjectMembershipInOrganization({
          userId: user.id,
          organizationId: organization.id,
          projectMembershipRepository,
          projectRepository,
        })

        if (existingProjectMembership) {
          return {
            status: "would_skip_existing_membership",
            email: normalizedEmail,
            organizationName: normalizedOrgName,
          }
        }
      }
    }

    return {
      status: "would_invite",
      email: normalizedEmail,
      organizationName: normalizedOrgName,
    }
  }

  private async findOrCreateOrganization({
    organizationName,
    organizationRepository,
  }: {
    organizationName: string
    organizationRepository: Repository<Organization>
  }): Promise<Organization> {
    const existing = await organizationRepository
      .createQueryBuilder("organization")
      .where("LOWER(organization.name) = LOWER(:name)", { name: organizationName })
      .getOne()

    if (existing) return existing

    return organizationRepository.save(organizationRepository.create({ name: organizationName }))
  }

  private async findOrCreatePlaceholderUser({
    email,
    fullName,
    userRepository,
  }: {
    email: string
    fullName?: string | null
    userRepository: Repository<User>
  }): Promise<User> {
    const existing = await userRepository.findOne({ where: { email } })
    if (existing) return existing

    const placeholderAuth0Id = `${PLACEHOLDER_AUTH0_ID_PREFIX}${randomUUID().slice(-12)}`
    return userRepository.save(
      userRepository.create({
        auth0Id: placeholderAuth0Id,
        email,
        name: fullName ?? null,
        pictureUrl: null,
      }),
    )
  }

  private async findOrCreateDefaultProject({
    organizationId,
    projectName,
    projectRepository,
  }: {
    organizationId: string
    projectName: string
    projectRepository: Repository<Project>
  }): Promise<Project> {
    const existing = await projectRepository.findOne({ where: { organizationId } })
    if (existing) return existing

    return projectRepository.save(projectRepository.create({ organizationId, name: projectName }))
  }

  private async findExistingProjectMembershipInOrganization({
    userId,
    organizationId,
    projectMembershipRepository,
    projectRepository,
  }: {
    userId: string
    organizationId: string
    projectMembershipRepository: Repository<ProjectMembership>
    projectRepository: Repository<Project>
  }): Promise<ProjectMembership | null> {
    const projects = await projectRepository.find({
      where: { organizationId },
      select: { id: true },
    })

    if (projects.length === 0) return null

    const projectIds = projects.map((project) => project.id)
    return projectMembershipRepository
      .createQueryBuilder("membership")
      .where("membership.userId = :userId", { userId })
      .andWhere("membership.projectId IN (:...projectIds)", { projectIds })
      .getOne()
  }
}
