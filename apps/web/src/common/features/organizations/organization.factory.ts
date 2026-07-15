import type {
  OrganizationMembershipRoleDto,
  OrganizationPermission,
} from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import { generateId } from "@/common/utils/generate-id"
import type { OrganizationListItem } from "./organizations.models"

const OWNER_PERMISSIONS: OrganizationPermission[] = [
  "organization.read",
  "organization.update",
  "organization.delete",
  "project.create",
  "project.list_all",
]

const ADMIN_PERMISSIONS: OrganizationPermission[] = [
  "organization.read",
  "organization.update",
  "project.create",
  "project.list_all",
]

const MEMBER_PERMISSIONS: OrganizationPermission[] = ["organization.read"]

function permissionsForRole(role: OrganizationMembershipRoleDto): OrganizationPermission[] {
  if (role === "owner") return OWNER_PERMISSIONS
  if (role === "admin") return ADMIN_PERMISSIONS
  return MEMBER_PERMISSIONS
}

type OrganizationFactoryTransientParams = {
  role?: OrganizationMembershipRoleDto
}

class OrganizationFactory extends Factory<
  OrganizationListItem,
  OrganizationFactoryTransientParams
> {}

export const organizationFactory = OrganizationFactory.define(({ params, transientParams }) => ({
  id: params.id ?? generateId(),
  name: params.name ?? faker.company.name(),
  permissions: params.permissions ?? permissionsForRole(transientParams.role ?? "member"),
  projects: params.projects ?? [],
}))
