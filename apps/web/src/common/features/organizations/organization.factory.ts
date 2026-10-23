import type { OrganizationPermission } from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { LegacyMembershipRole } from "@/common/features/memberships/membership-roles"
import { generateId } from "@/common/utils/generate-id"
import type { Organization } from "./organizations.models"

const OWNER_PERMISSIONS: OrganizationPermission[] = [
  "organization.read",
  "organization.update",
  "organization.delete",
  "project.create",
]

const ADMIN_PERMISSIONS: OrganizationPermission[] = [
  "organization.read",
  "organization.update",
  "project.create",
]

const MEMBER_PERMISSIONS: OrganizationPermission[] = ["organization.read"]

function permissionsForRole(role: LegacyMembershipRole): OrganizationPermission[] {
  if (role === "owner") return OWNER_PERMISSIONS
  if (role === "admin") return ADMIN_PERMISSIONS
  return MEMBER_PERMISSIONS
}

type OrganizationFactoryTransientParams = {
  role?: LegacyMembershipRole
}

class OrganizationFactory extends Factory<Organization, OrganizationFactoryTransientParams> {}

export const organizationFactory = OrganizationFactory.define(({ params, transientParams }) => ({
  id: params.id ?? generateId(),
  name: params.name ?? faker.company.name(),
  permissions: params.permissions ?? permissionsForRole(transientParams.role ?? "member"),
}))
