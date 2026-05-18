import type { Repository } from "typeorm"
import type { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import type { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import type { User } from "@/domains/users/user.entity"
import type { Invitation } from "../invitation.entity"

export type BaseInviteMembersContext = {
  invitationRepository: Repository<Invitation>
  userRepository: Repository<User>
}

export type BaseAcceptanceRepositories = {
  invitationRepository: Repository<Invitation>
  organizationMembershipRepository: Repository<OrganizationMembership>
  projectMembershipRepository: Repository<ProjectMembership>
  userRepository: Repository<User>
}
