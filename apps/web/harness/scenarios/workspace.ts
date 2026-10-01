import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import {
  organizationMembershipFactory,
  projectMembershipFactory,
  userFactory,
} from "@/common/features/me/me.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { myProjectFactory, projectFactory } from "@/common/features/projects/projects.factory"
import type { Fixtures } from "./types"

export const HARNESS_ORGANIZATION_ID = "org-1"
export const HARNESS_PROJECT_ID = "proj-1"

/** A logged-in owner of one organization and one project: what every protected page needs. */
export function buildWorkspace({ featureFlags = [] }: { featureFlags?: FeatureFlagKey[] } = {}) {
  const organization = organizationFactory.build({ id: HARNESS_ORGANIZATION_ID })
  const project = {
    ...projectFactory.transient({ organization }).build({ id: HARNESS_PROJECT_ID }),
    featureFlags,
  }
  const myProject = myProjectFactory.transient({ organization }).build({ id: HARNESS_PROJECT_ID })
  const user = userFactory
    .transient({
      organizationMemberships: [
        organizationMembershipFactory.transient({ organization }).build({ role: "owner" }),
      ],
      projectMemberships: [
        projectMembershipFactory.transient({ project }).build({ role: "owner" }),
      ],
    })
    .build({ termsAccepted: true })

  const fixtures: Fixtures = {
    "me.getMe": { user, currentTerms: null },
    "invitations.listPendingMine": { organizations: [], projects: [] },
    "organizations.list": [organization],
    "projects.getAll": [project],
    "projects.getAllMine": [myProject],
  }
  return { organization, project, user, fixtures }
}
