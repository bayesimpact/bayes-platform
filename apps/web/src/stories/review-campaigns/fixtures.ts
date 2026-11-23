import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"

const mockOrganization = organizationFactory.build({ id: "org-1" })

export const mockProject = projectFactory
  .transient({ organization: mockOrganization })
  .build({ id: "proj-1", name: "Demo project" })
