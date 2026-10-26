import { faker } from "@faker-js/faker"
import type {
  MembersTableMember,
  ProjectRoleOption,
} from "@/studio/features/project-memberships/components/members-table/members-table.models"

const MS_PER_DAY = 86_400_000
const now = Date.now()

/** The `project` roles of the RBAC catalog, as the `role` table names them. */
export const mockProjectRoles: ProjectRoleOption[] = [
  { key: "project_owner", name: "Project Owner" },
  { key: "project_admin", name: "Project Admin" },
  { key: "project_member", name: "Project Member" },
]

const [ownerRole, adminRole, memberRole] = mockProjectRoles as [
  ProjectRoleOption,
  ProjectRoleOption,
  ProjectRoleOption,
]

/** The workspace roles the API offers to give: owner is set at creation. */
export const mockGrantableProjectRoles: ProjectRoleOption[] = [adminRole, memberRole]

export const mockCurrentUserId = "user-me"

function buildMember(
  index: number,
  overrides: Partial<MembersTableMember> & Pick<MembersTableMember, "roles">,
): MembersTableMember {
  faker.seed(1076 + index)
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  return {
    userId: `user-${index}`,
    userName: `${firstName} ${lastName}`,
    userEmail: faker.internet.email({ firstName, lastName }).toLowerCase(),
    userHasSignedIn: true,
    createdAt: now - (index + 1) * 9 * MS_PER_DAY,
    ...overrides,
  }
}

export const mockMe = buildMember(0, {
  userId: mockCurrentUserId,
  roles: [ownerRole],
})

/** A second owner, so the viewer can remove one owner but not both. */
const coOwner = buildMember(1, { roles: [ownerRole, adminRole] })

const rolePatterns: ProjectRoleOption[][] = [
  [adminRole],
  [memberRole],
  [adminRole, memberRole],
  [memberRole],
  [],
  [adminRole, memberRole],
  [adminRole],
]

export const mockManyMembers: MembersTableMember[] = [
  mockMe,
  coOwner,
  ...Array.from({ length: 22 }, (_, offset) => {
    const index = offset + 2
    return buildMember(index, {
      roles: rolePatterns[offset % rolePatterns.length] ?? [],
      userHasSignedIn: offset % 5 !== 3,
      // Added by email from a review campaign: no name until they sign in.
      ...(offset % 9 === 4 ? { userName: null, userHasSignedIn: false } : {}),
    })
  }),
]

export const mockOwners = mockManyMembers.filter((member) =>
  member.roles.some((role) => role.key === "project_owner"),
)
