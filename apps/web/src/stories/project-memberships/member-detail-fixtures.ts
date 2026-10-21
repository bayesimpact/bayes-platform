import type {
  MemberDetailMember,
  MemberResourceRoles,
  RoleOption,
} from "@/studio/features/project-memberships/components/member-detail/member-detail.models"
import { mockCurrentUserId, mockProjectRoles } from "./fixtures"

/** The `agent` and `review_campaign` roles of the RBAC catalog, as the `role` table names them. */
export const mockAgentRoles: RoleOption[] = [
  { key: "agent_owner", name: "Agent Owner" },
  { key: "agent_admin", name: "Agent Admin" },
  { key: "agent_member", name: "Agent Member" },
]

export const mockCampaignRoles: RoleOption[] = [
  { key: "review_campaign_tester", name: "Review Campaign Tester" },
  { key: "review_campaign_reviewer", name: "Review Campaign Reviewer" },
]

const roleByKey = new Map(
  [...mockProjectRoles, ...mockAgentRoles, ...mockCampaignRoles].map((role) => [role.key, role]),
)

function roles(...keys: string[]): RoleOption[] {
  return keys.flatMap((key) => roleByKey.get(key) ?? [])
}

/** Sample grants, enough to show the permission list; the catalog in the API is the reference. */
const PERMISSIONS_BY_ROLE: Record<string, string[]> = {
  project_owner: [
    "project.read",
    "project.update",
    "project.delete",
    "project.member.read",
    "project.member.invite",
    "project.member.update",
    "project.member.delete",
    "agent.create",
    "studio.ui.read",
    "desk.ui.read",
  ],
  project_admin: [
    "project.read",
    "project.update",
    "project.member.read",
    "project.member.invite",
    "project.member.update",
    "project.member.delete",
    "agent.create",
    "studio.ui.read",
    "desk.ui.read",
  ],
  project_member: ["project.read", "desk.ui.read"],
  agent_owner: [
    "agent.read",
    "agent.update",
    "agent.delete",
    "agent.duplicate",
    "agent.analytics.read",
    "agent.member.read",
    "agent.member.invite",
    "agent.member.delete",
  ],
  agent_admin: [
    "agent.read",
    "agent.update",
    "agent.delete",
    "agent.duplicate",
    "agent.analytics.read",
    "agent.member.read",
    "agent.member.invite",
    "agent.member.delete",
  ],
  agent_member: ["agent.read"],
  review_campaign_tester: [
    "review_campaign.read",
    "review_campaign.tester_session.read",
    "review_campaign.tester_session.create",
    "review_campaign.tester_feedback.create",
    "review_campaign.tester_survey.create",
  ],
  review_campaign_reviewer: [
    "review_campaign.read",
    "review_campaign.reviewer_session.read",
    "review_campaign.reviewer_review.create",
    "review_campaign.reviewer_review.update",
  ],
}

/** The union of what the roles grant, as the API computes it. */
export function permissionsOf(heldRoles: RoleOption[]): string[] {
  return [...new Set(heldRoles.flatMap((role) => PERMISSIONS_BY_ROLE[role.key] ?? []))]
}

function resource(
  kind: MemberResourceRoles["kind"],
  resourceId: string,
  resourceName: string,
  heldRoles: RoleOption[],
  detail?: string,
): MemberResourceRoles {
  const grantableRoles =
    kind === "project" ? mockProjectRoles : kind === "agent" ? mockAgentRoles : mockCampaignRoles
  return {
    kind,
    resourceId,
    resourceName,
    detail,
    roles: heldRoles,
    grantableRoles,
    canManage: true,
    permissions: permissionsOf(heldRoles),
  }
}

export const mockDetailMember: MemberDetailMember = {
  id: "membership-7",
  userId: "user-7",
  userName: "Cruz Braun",
  userEmail: "cruz_braun84@hotmail.com",
  userHasSignedIn: true,
}

export const mockSelfMember: MemberDetailMember = {
  id: "membership-me",
  userId: mockCurrentUserId,
  userName: "Alverta Mante",
  userEmail: "alverta_mante@gmail.com",
  userHasSignedIn: true,
}

export const mockWorkspace = resource(
  "project",
  "proj-1",
  "Demo project",
  roles("project_admin", "project_member"),
)

export const mockAgents: MemberResourceRoles[] = [
  resource("agent", "agent-1", "Helpful Assistant", roles("agent_admin"), "Conversation"),
  resource("agent", "agent-2", "Scheduling Bot", roles("agent_member"), "Conversation"),
  resource("agent", "agent-3", "Intake Form Agent", [], "Extraction"),
]

export const mockCampaigns: MemberResourceRoles[] = [
  resource(
    "review_campaign",
    "campaign-1",
    "Pilot review",
    roles("review_campaign_tester", "review_campaign_reviewer"),
    "Active",
  ),
  resource("review_campaign", "campaign-2", "Spring review", [], "Draft"),
]

export function withoutRoles(resources: MemberResourceRoles[]): MemberResourceRoles[] {
  return resources.map((entry) => ({ ...entry, roles: [], permissions: [] }))
}

export function readOnly(resources: MemberResourceRoles[]): MemberResourceRoles[] {
  return resources.map((entry) => ({ ...entry, canManage: false }))
}

export const mockOwnerWorkspace = resource(
  "project",
  "proj-1",
  "Demo project",
  roles("project_owner"),
)
