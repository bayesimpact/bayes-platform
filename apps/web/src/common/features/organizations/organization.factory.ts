import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import { generateId } from "@/common/utils/generate-id"
import type { Organization } from "./organizations.models"

class OrganizationFactory extends Factory<Organization> {}

export const organizationFactory = OrganizationFactory.define(({ params }) => ({
  id: params.id ?? generateId(),
  name: params.name ?? faker.company.name(),
  createdAt: params.createdAt ?? Date.now(),
  projects: params.projects ?? [],
}))
