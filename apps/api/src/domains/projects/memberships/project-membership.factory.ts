import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
import type { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import {
  organizationMembershipFactory,
  saveOrgMembership,
} from "@/domains/organizations/memberships/organization-membership.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import type { Project } from "../project.entity"
import type { ProjectMembership, ProjectMembershipRole } from "./project-membership.entity"
import { PLACEHOLDER_AUTH0_ID_PREFIX } from "./project-memberships.service"

type ProjectMembershipTransientParams = {
  project: Project
  user: User
}

class ProjectMembershipFactory extends Factory<
  ProjectMembership,
  ProjectMembershipTransientParams
> {
  member() {
    return this.params({ role: "member" })
  }

  admin() {
    return this.params({ role: "admin" })
  }

  owner() {
    return this.params({ role: "owner" })
  }
}

export const projectMembershipFactory = ProjectMembershipFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }
    if (!transientParams.user) {
      throw new Error("user transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      projectId: transientParams.project.id,
      userId: transientParams.user.id,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt || null,
      project: transientParams.project,
      user: transientParams.user,
      role: (params.role || "member") as ProjectMembershipRole,
    } satisfies ProjectMembership
  },
)

/**
 * Saves a ProjectMembership to both the legacy table and user_memberships.
 * Use this in tests instead of `repositories.projectMembershipRepository.save()`
 * to keep user_memberships in sync during the dual-write transition period.
 */
export const saveProjectMembership = async ({
  repositories,
  membership,
}: {
  repositories: AllRepositories
  membership: ProjectMembership
}) => {
  const saved = await repositories.projectMembershipRepository.save(membership)
  await repositories.userMembershipRepository.save(
    userMembershipFactory.build({
      userId: saved.userId,
      resourceType: "project",
      resourceId: saved.projectId,
      role: saved.role,
    }),
  )
  return saved
}

export const addUserToProject = async ({
  repositories,
  project,
  user,
  membership,
}: {
  repositories: AllRepositories
  project: Project
  user?: User
  membership?: Partial<ProjectMembership>
}) => {
  const createMembership = async (user: User) => {
    const newMembership = await saveProjectMembership({
      repositories,
      membership: projectMembershipFactory.transient({ project, user }).build(membership),
    })
    return { membership: newMembership, user }
  }

  if (user) return await createMembership(user)

  const newUser = await repositories.userRepository.save(userFactory.build(user))
  return await createMembership(newUser)
}

export const inviteUserToProject = async ({
  repositories,
  organization,
  project,
  user,
  projectMembership,
  organizationMembership,
}: {
  repositories: AllRepositories
  organization?: Organization
  project: Project
  user?: Partial<User>
  organizationMembership?: Partial<OrganizationMembership>
  projectMembership?: Partial<ProjectMembership>
}) => {
  user = user ?? {
    email: "invited@example.com",
    name: "Invited User",
    auth0Id: `${PLACEHOLDER_AUTH0_ID_PREFIX}-test`,
  }
  const invitedUser = userFactory.build(user)
  await repositories.userRepository.save(invitedUser)

  if (organization) {
    await saveOrgMembership({
      repositories,
      membership: organizationMembershipFactory
        .transient({ user: invitedUser, organization })
        .build(organizationMembership),
    })
  }

  const invitationToken = randomUUID()
  const membership = await saveProjectMembership({
    repositories,
    membership: projectMembershipFactory
      .transient({ project, user: invitedUser })
      .build(projectMembership),
  })

  return { membership, invitedUser, invitationToken }
}
