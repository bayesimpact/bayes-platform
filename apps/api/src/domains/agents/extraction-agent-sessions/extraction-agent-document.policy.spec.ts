import type { BaseAgentSessionTypeDto } from "@caseai-connect/api-contracts"
import {
  type ResourceState,
  testPolicyScopedByProject,
} from "@/common/test/test-project-scoped-policy.helpers"
import { documentFactory } from "@/domains/documents/document.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { ProjectMembershipRole } from "@/domains/projects/memberships/project-membership.types"
import type { Project } from "@/domains/projects/project.entity"
import { ExtractionAgentDocumentPolicy } from "./extraction-agent-document.policy"

describe("ExtractionAgentDocumentPolicy", () => {
  const { buildPolicy } = testPolicyScopedByProject({
    buildResource: (params: { organization: Organization; project: Project }) =>
      documentFactory.transient(params).build({ sourceType: "extraction" }),
    ResourcePolicy: ExtractionAgentDocumentPolicy,
  })

  const cases: [BaseAgentSessionTypeDto, ProjectMembershipRole, ResourceState, boolean][] = [
    ["live", "owner", "noResource", true],
    ["live", "admin", "noResource", true],
    ["live", "member", "noResource", true],
    ["live", "member", "sameOrganization", true],
    ["live", "member", "differentOrganization", false],
    ["playground", "owner", "noResource", true],
    ["playground", "admin", "noResource", true],
    ["playground", "member", "noResource", false],
    ["playground", "member", "sameOrganization", false],
    ["playground", "owner", "differentOrganization", false],
  ]

  describe.each(["canCreate", "canList"] as const)("%s", (method) => {
    describe.each(
      cases,
    )("for a %s run when user is %s with %s document", (type, projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole, options: type })
        expect(policy[method]()).toBe(expected)
      })
    })

    it("should return false without a run type", () => {
      const policy = buildPolicy({ resourceState: "noResource", projectRole: "member" })
      expect(policy[method]()).toBe(false)
    })

    it("should return false for a user who is not a project member", () => {
      const policy = buildPolicy({ resourceState: "noResource", options: "live" })
      expect(policy[method]()).toBe(false)
    })
  })
})
