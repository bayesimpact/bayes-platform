import type { DataSource, Repository } from "typeorm"
import type { TransactionService } from "@/common/transaction/transaction.service"
import { hasRole, type MembershipRole } from "@/domains/memberships/membership-roles"
import type { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
import { Organization } from "@/domains/organizations/organization.entity"
import type { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
import { Project } from "@/domains/projects/project.entity"
import { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import { User } from "@/domains/users/user.entity"

/** Holds `org_member` and no higher organization role. */
function isOnlyOrganizationMember(membership: { roles: MembershipRole[] }): boolean {
  return (
    hasRole(membership, ORGANIZATION_ROLES.member) &&
    !hasRole(membership, ORGANIZATION_ROLES.admin) &&
    !hasRole(membership, ORGANIZATION_ROLES.owner)
  )
}

export type ProvisionWorkspaceOwnerInput = {
  email: string
  organizationName: string
  workspaceName?: string | null
  fullName?: string | null
}

export type ProvisionWorkspaceOwnerResult = {
  /**
   * `granted_without_organization_admin`: the user already was an organization member (for
   * example a review campaign participant) and stays one, so staff must promote them by hand.
   */
  status: "granted" | "granted_without_organization_admin" | "skipped_existing_membership"
  email: string
  organizationName: string
  organizationId: string
  projectId: string
  userId: string
  message: string
}

export type PreviewWorkspaceOwnerProvisioningResult = {
  status:
    | "would_grant"
    | "would_grant_without_organization_admin"
    | "would_skip_existing_membership"
  email: string
  organizationName: string
}

/**
 * Creates an organization and its first workspace for a customer, and gives
 * the owner admin access by email. Nothing is sent: the person gets the access
 * at their first OIDC sign-in with that email.
 */
export class WorkspaceOwnerProvisioningService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly organizationMembershipsService: OrganizationMembershipsService,
    private readonly projectMembershipsService: ProjectMembershipsService,
    private readonly transactionService: TransactionService,
  ) {}

  async provisionWorkspaceOwner(
    input: ProvisionWorkspaceOwnerInput,
  ): Promise<ProvisionWorkspaceOwnerResult> {
    const normalizedEmail = input.email.trim().toLowerCase()
    const normalizedOrgName = input.organizationName.trim()
    const projectName = input.workspaceName?.trim() || normalizedOrgName

    return this.transactionService.run(async () => {
      const manager = this.transactionService.getManager()
      const organizationRepository = manager.getRepository(Organization)
      const projectRepository = manager.getRepository(Project)
      const userRepository = manager.getRepository(User)

      const organization = await this.findOrCreateOrganization({
        organizationName: normalizedOrgName,
        organizationRepository,
      })

      const user = await this.findOrCreateUserByEmail({
        email: normalizedEmail,
        fullName: input.fullName,
        userRepository,
      })

      const existingProjectMembership =
        await this.projectMembershipsService.findProjectMembershipInOrganization({
          userId: user.id,
          organizationId: organization.id,
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

      const existingOrgMembership =
        await this.organizationMembershipsService.findOrganizationMembership({
          userId: user.id,
          organizationId: organization.id,
        })
      if (!existingOrgMembership) {
        await this.organizationMembershipsService.upsertOrganizationAdminMembership({
          userId: user.id,
          organizationId: organization.id,
        })
      }

      await this.projectMembershipsService.upsertProjectAdminMembership({
        userId: user.id,
        projectId: project.id,
      })

      if (existingOrgMembership && isOnlyOrganizationMember(existingOrgMembership)) {
        return {
          status: "granted_without_organization_admin" as const,
          email: normalizedEmail,
          organizationName: normalizedOrgName,
          organizationId: organization.id,
          projectId: project.id,
          userId: user.id,
          message:
            "Workspace access granted, but the user was already an organization member and stays one.",
        }
      }

      return {
        status: "granted" as const,
        email: normalizedEmail,
        organizationName: normalizedOrgName,
        organizationId: organization.id,
        projectId: project.id,
        userId: user.id,
        message: "Access granted.",
      }
    })
  }

  async previewProvisioning(input: {
    email: string
    organizationName: string
  }): Promise<PreviewWorkspaceOwnerProvisioningResult> {
    const normalizedEmail = input.email.trim().toLowerCase()
    const normalizedOrgName = input.organizationName.trim()

    const user = await this.dataSource.getRepository(User).findOne({
      where: { email: normalizedEmail },
    })

    if (user) {
      const organization = await this.dataSource
        .getRepository(Organization)
        .createQueryBuilder("organization")
        .where("LOWER(organization.name) = LOWER(:name)", { name: normalizedOrgName })
        .getOne()

      if (organization) {
        const existingProjectMembership =
          await this.projectMembershipsService.findProjectMembershipInOrganization({
            userId: user.id,
            organizationId: organization.id,
          })

        if (existingProjectMembership) {
          return {
            status: "would_skip_existing_membership",
            email: normalizedEmail,
            organizationName: normalizedOrgName,
          }
        }

        const existingOrgMembership =
          await this.organizationMembershipsService.findOrganizationMembership({
            userId: user.id,
            organizationId: organization.id,
          })
        if (existingOrgMembership && isOnlyOrganizationMember(existingOrgMembership)) {
          return {
            status: "would_grant_without_organization_admin",
            email: normalizedEmail,
            organizationName: normalizedOrgName,
          }
        }
      }
    }

    return {
      status: "would_grant",
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

  private async findOrCreateUserByEmail({
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

    return userRepository.save(
      userRepository.create({
        // Linked to the person's OIDC identity at their first sign-in
        authSubject: null,
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
}
