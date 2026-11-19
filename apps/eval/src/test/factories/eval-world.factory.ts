import type {
  AgentVersionOutputDto,
  CampaignInvitationOutputDto,
  CampaignReportOutputDto,
  ConversationMessageOutputDto,
  InvitationOutputDto,
  MyOrganizationOutputDto,
  MyProjectOutputDto,
  ProjectAgentOutputDto,
  ReviewCampaignDetailOutputDto,
  ReviewCampaignRoleDto,
  TesterSessionOutputDto,
  TesterSurveyOutputDto,
} from "@caseai-connect/eval-contracts"
import {
  EVALUATION_UI_READ_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION,
  REVIEW_CAMPAIGN_REPORT_READ_PERMISSION,
  TOOL_NAMES,
} from "@caseai-connect/eval-contracts"
import { agentVersionIdOf, buildAgentVersion, buildProjectAgent } from "./agents.factory"
import { buildConversationMessage, buildToolCall } from "./conversations.factory"
import { buildInvitation } from "./invitations.factory"
import { buildMyOrganization, buildMyProject } from "./projects.factory"
import {
  buildCampaignInvitation,
  buildCampaignMembership,
  buildCampaignReport,
  buildReviewCampaign,
  buildReviewerReview,
  buildReviewSession,
  buildTesterSession,
  daysAgo,
  type ReviewSessionRecord,
} from "./review-campaigns.factory"

/** What a project's owner or admin holds for its review campaigns, beside evaluating its agents. */
const MANAGER_PERMISSIONS = [
  "project.read",
  EVALUATION_UI_READ_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION,
  REVIEW_CAMPAIGN_REPORT_READ_PERMISSION,
]

/**
 * Everything the mocked API answers: the person's organizations, projects and agents, the review
 * campaigns of those projects, and what the person does in the campaigns they test or review.
 */
export type EvalWorld = {
  organizations: MyOrganizationOutputDto[]
  projects: MyProjectOutputDto[]
  agents: ProjectAgentOutputDto[]
  /**
   * The versions of an agent's settings, by agent id, newest first: those of
   * `buildAgentVersions` for an agent with none here.
   */
  agentVersions: Record<string, AgentVersionOutputDto[]>
  campaigns: ReviewCampaignDetailOutputDto[]
  /** The pending invitations of each campaign, by campaign id. */
  invitations: Record<string, CampaignInvitationOutputDto[]>
  /** The report of each campaign, by campaign id: an empty one when none is set. */
  reports: Record<string, CampaignReportOutputDto>
  /** The roles the signed-in person holds in campaigns, by campaign id. */
  myCampaignRoles: Record<string, ReviewCampaignRoleDto[]>
  /** The sessions the signed-in person started as a tester, by campaign id, newest first. */
  testerSessions: Record<string, TesterSessionOutputDto[]>
  /** The messages of the sessions the person started as a tester, by session id, oldest first. */
  testerMessages: Record<string, ConversationMessageOutputDto[]>
  /** The signed-in person's final survey, by campaign id. */
  testerSurveys: Record<string, TesterSurveyOutputDto | null>
  /** The testers' sessions the signed-in person can review, by campaign id, newest first. */
  reviewSessions: Record<string, ReviewSessionRecord[]>
  /**
   * The signed-in person's pending invitations, with the campaign role each one grants once
   * accepted, when it is one.
   */
  myInvitations: {
    invitation: InvitationOutputDto
    grantsCampaignRole: { campaignId: string; role: ReviewCampaignRoleDto } | null
  }[]
}

const emptyCampaignData = {
  agentVersions: {},
  campaigns: [],
  invitations: {},
  reports: {},
  myCampaignRoles: {},
  testerSessions: {},
  testerMessages: {},
  testerSurveys: {},
  reviewSessions: {},
  myInvitations: [],
} satisfies Partial<EvalWorld>

/**
 * The main case: the owner of one project who is its evaluator too, so its one agent opens both
 * its evaluations and its review campaigns. The agent has a draft, an active and a closed campaign.
 */
export function buildEvalWorld(): EvalWorld {
  const organization = buildMyOrganization()
  const project = buildMyProject(organization, { permissions: MANAGER_PERMISSIONS })
  const agent = buildProjectAgent(project)
  const draft = buildReviewCampaign(agent, organization.id, {
    name: "Onboarding answers",
    description: "Check how the assistant guides a new customer through their first week.",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  })
  const active = buildReviewCampaign(agent, organization.id, {
    status: "active",
    createdAt: daysAgo(6),
    memberships: [
      buildCampaignMembership("sam@example.org", ["tester", "reviewer"]),
      buildCampaignMembership("jo@example.org", ["tester"], { userHasSignedIn: false }),
      buildCampaignMembership("lee@example.org", ["reviewer"]),
    ],
  })
  const closed = buildReviewCampaign(agent, organization.id, {
    name: "Spring review",
    description: "The review of the assistant before its spring release.",
    status: "closed",
    // It reviewed the version before the one in production.
    agentSettingsId: agentVersionIdOf(agent, 2),
    createdAt: daysAgo(40),
    updatedAt: daysAgo(12),
    memberships: [buildCampaignMembership("sam@example.org", ["tester"])],
    aggregates: { meanTesterRating: 4.25, surveyCount: 3, sessionCount: 12 },
  })
  return {
    ...emptyCampaignData,
    organizations: [organization],
    projects: [project],
    agents: [agent],
    campaigns: [draft, active, closed],
    invitations: {
      [active.id]: [
        buildCampaignInvitation(),
        buildCampaignInvitation({
          invitedEmail: "alix@example.org",
          role: "reviewer",
          invitedAt: daysAgo(3),
        }),
      ],
    },
    reports: { [active.id]: buildCampaignReport(), [closed.id]: buildCampaignReport() },
  }
}

/**
 * The owner of a project whose agent was never saved, a copy of another one for instance: it has
 * a draft only, which no campaign runs on.
 */
export function buildNoSavedVersionWorld(): EvalWorld {
  const world = buildNoCampaignWorld()
  return {
    ...world,
    agentVersions: Object.fromEntries(
      world.agents.map((agent) => [agent.id, [buildAgentVersion(agent, 1, { isDraft: true })]]),
    ),
  }
}

/**
 * The main case, whose closed campaign ran on a version archived since, and whose draft points at
 * it too: the agent's history no longer lists it.
 */
export function buildArchivedVersionWorld(): EvalWorld {
  const world = buildEvalWorld()
  const archivedId = crypto.randomUUID()
  return {
    ...world,
    campaigns: world.campaigns.map((campaign) =>
      campaign.status === "active" ? campaign : { ...campaign, agentSettingsId: archivedId },
    ),
  }
}

/**
 * An owner of a project who is not its evaluator, as owners and admins are by default: the agent
 * opens its review campaigns, and nothing else.
 */
export function buildCampaignManagerWorld(): EvalWorld {
  const world = buildEvalWorld()
  return {
    ...world,
    projects: world.projects.map((project) => ({
      ...project,
      permissions: project.permissions.filter(
        (permission) => permission !== EVALUATION_UI_READ_PERMISSION,
      ),
    })),
  }
}

/**
 * A person who holds everything at once: they evaluate the agent, manage its review campaigns,
 * test the active one and review the closed one.
 */
export function buildEveryAccessWorld(): EvalWorld {
  const world = buildEvalWorld()
  const roles: [string, ReviewCampaignRoleDto][] = [
    ["active", "tester"],
    ["closed", "reviewer"],
  ]
  return {
    ...world,
    myCampaignRoles: Object.fromEntries(
      roles.flatMap(([status, role]) =>
        world.campaigns
          .filter((campaign) => campaign.status === status)
          .map((campaign) => [campaign.id, [role]]),
      ),
    ),
  }
}

/**
 * The main person, with two invitations to answer: one to test the agent's active campaign, which
 * lists it among their campaigns once accepted, and one to another project.
 */
export function buildPendingInvitationsWorld(): EvalWorld {
  const world = buildEvalWorld()
  const active = world.campaigns.find((campaign) => campaign.status === "active")
  const [project] = world.projects
  if (!active || !project) throw new Error("The main world has an active campaign")
  return {
    ...world,
    myInvitations: [
      {
        invitation: buildInvitation({
          projectName: project.name,
          targetName: active.name,
          invitedAt: daysAgo(0),
        }),
        grantsCampaignRole: { campaignId: active.id, role: "tester" },
      },
      {
        invitation: buildInvitation({
          organizationName: "Operations",
          projectName: "Onboarding",
          targetType: "project",
          targetName: "Onboarding",
          role: "member",
          invitedAt: daysAgo(2),
        }),
        grantsCampaignRole: null,
      },
    ],
  }
}

/** The owner of a project whose agent has no review campaign yet. */
export function buildNoCampaignWorld(): EvalWorld {
  return { ...buildEvalWorld(), campaigns: [], invitations: {}, reports: {} }
}

/**
 * The evaluator of two projects in two organizations, with agents of both types, and a project
 * that opens the Desk only, whose agents stay out of the switcher. They manage no campaign.
 */
export function buildSeveralProjectsWorld(): EvalWorld {
  const product = buildMyOrganization({ name: "Product" })
  const operations = buildMyOrganization({ name: "Operations" })
  const pricing = buildMyProject(product, { name: "Pricing" })
  const onboarding = buildMyProject(operations, { name: "Onboarding" })
  const deskOnly = buildMyProject(operations, {
    name: "Help desk",
    permissions: ["project.read", "desk.ui.read"],
  })
  return {
    ...emptyCampaignData,
    organizations: [product, operations],
    projects: [pricing, onboarding, deskOnly],
    agents: [
      buildProjectAgent(pricing, { name: "Helpful Assistant" }),
      buildProjectAgent(pricing, { name: "Document Reader", type: "extraction" }),
      buildProjectAgent(onboarding, { name: "Writing Helper" }),
      buildProjectAgent(deskOnly, { name: "Support Assistant" }),
    ],
  }
}

/**
 * An evaluator of many projects in three organizations, each with several agents: the case the
 * list of agents and the command center must stay easy to read in.
 */
export function buildManyAgentsWorld(): EvalWorld {
  const product = buildMyOrganization({ name: "Product" })
  const operations = buildMyOrganization({ name: "Operations" })
  const support = buildMyOrganization({ name: "Support" })
  const agentsByProject: [MyOrganizationOutputDto, string, string[]][] = [
    [product, "Pricing", ["Helpful Assistant", "Plan Advisor", "Quote Reader"]],
    [product, "Product tour", ["Feature Guide", "Release Notes Writer"]],
    [
      operations,
      "Onboarding",
      ["Writing Helper", "Welcome Assistant", "Form Reader", "Checklist Guide"],
    ],
    [operations, "Billing", ["Invoice Reader", "Billing Assistant"]],
    [support, "Help center", ["Support Assistant", "Article Writer", "Ticket Reader"]],
    [support, "Feedback", ["Survey Reader", "Summary Writer"]],
  ]
  const projects = agentsByProject.map(([organization, name]) =>
    buildMyProject(organization, { name }),
  )
  return {
    ...emptyCampaignData,
    organizations: [product, operations, support],
    projects,
    agents: agentsByProject.flatMap(([, , agentNames], index) => {
      const project = projects[index]
      if (!project) return []
      return agentNames.map((name) =>
        buildProjectAgent(project, {
          name,
          type: name.endsWith("Reader") ? "extraction" : "conversation",
        }),
      )
    }),
  }
}

/** The evaluator of a project that has no agent yet. */
export function buildNoAgentWorld(): EvalWorld {
  const organization = buildMyOrganization()
  return {
    ...emptyCampaignData,
    organizations: [organization],
    projects: [buildMyProject(organization)],
    agents: [],
  }
}

/** A person the app holds nothing for: their only project opens the Desk alone. */
export function buildNoEvaluationAccessWorld(): EvalWorld {
  const organization = buildMyOrganization()
  const project = buildMyProject(organization, {
    name: "Support",
    permissions: ["project.read", "desk.ui.read"],
  })
  return {
    ...emptyCampaignData,
    organizations: [organization],
    projects: [project],
    agents: [buildProjectAgent(project)],
  }
}

/**
 * A person who holds no project role: they test one active campaign, where they started two
 * sessions, and review two others, one active and one closed. The campaign roles give them the
 * projects, with no permission that opens their agents.
 */
export function buildParticipantWorld(): EvalWorld {
  const organization = buildMyOrganization()
  const project = buildMyProject(organization, {
    permissions: ["project.read", "tester.ui.read", "reviewer.ui.read"],
  })
  const agent = buildProjectAgent(project)
  const tested = buildReviewCampaign(agent, organization.id, { status: "active" })
  const reviewed = buildReviewCampaign(agent, organization.id, {
    name: "Pricing questions",
    description: "Review how the assistant answers questions about plans and prices.",
    status: "active",
  })
  const closed = buildReviewCampaign(agent, organization.id, {
    name: "Spring review",
    description: "The review of the assistant before its spring release.",
    status: "closed",
  })
  const myReview = buildReviewerReview({ comment: "Correct and to the point.", overallRating: 5 })
  const openSession = buildTesterSession(agent.id, { createdAt: daysAgo(0) })
  const ratedSession = buildTesterSession(agent.id, {
    createdAt: daysAgo(2),
    feedbackStatus: "submitted",
  })
  return {
    ...emptyCampaignData,
    organizations: [organization],
    projects: [project],
    agents: [agent],
    campaigns: [tested, reviewed, closed],
    reports: { [reviewed.id]: buildCampaignReport(), [closed.id]: buildCampaignReport() },
    myCampaignRoles: {
      [tested.id]: ["tester"],
      [reviewed.id]: ["reviewer"],
      [closed.id]: ["reviewer"],
    },
    testerSessions: { [tested.id]: [openSession, ratedSession] },
    testerMessages: {
      [openSession.id]: [
        buildConversationMessage(),
        buildConversationMessage({
          role: "user",
          content: "Which plan should a team of five pick?",
        }),
        buildConversationMessage({
          content:
            "For a team of five, the **Pro** plan fits best:\n\n- shared workspaces\n- five seats included\n\nThe Starter plan stops at one team.",
          toolCalls: [
            buildToolCall(),
            // The documents the reply relied on, as the Desk shows them.
            buildToolCall({
              name: TOOL_NAMES.sources,
              arguments: {
                sources: [
                  {
                    documentId: crypto.randomUUID(),
                    documentTitle: "Pricing guide.pdf",
                    documentSourceType: "project",
                    chunks: [
                      {
                        chunkId: crypto.randomUUID(),
                        partialContent: "The Pro plan covers unlimited teams…",
                      },
                    ],
                  },
                ],
              },
            }),
          ],
        }),
      ],
      [ratedSession.id]: [
        buildConversationMessage(),
        buildConversationMessage({ role: "user", content: "Can we switch plan later?" }),
        buildConversationMessage({
          content: "Yes. You can change plan at any time from the billing page.",
        }),
      ],
    },
    testerSurveys: { [tested.id]: null },
    reviewSessions: {
      [reviewed.id]: [
        buildReviewSession({ startedAt: daysAgo(1), otherReviews: [buildReviewerReview()] }),
        buildReviewSession({
          startedAt: daysAgo(2),
          myReview,
          otherReviews: [buildReviewerReview({ overallRating: 3 })],
          formResult: {
            schema: {
              type: "object",
              properties: {
                title: { type: "string", title: "Title" },
                summary: { type: "string", title: "Summary" },
              },
            },
            value: { title: "Plan for a team of five" },
          },
        }),
        buildReviewSession({ startedAt: daysAgo(3), testerFeedback: null, transcript: [] }),
      ],
      [closed.id]: [buildReviewSession({ startedAt: daysAgo(20), myReview })],
    },
  }
}

/**
 * A person who only tests, on campaigns of two agents: the sidebar's header switches between them,
 * and the command center lists them under Your campaigns.
 */
export function buildSeveralCampaignAgentsWorld(): EvalWorld {
  const world = buildParticipantWorld()
  const [project] = world.projects
  const [organization] = world.organizations
  if (!project || !organization) throw new Error("The participant world has a project")
  const writer = buildProjectAgent(project, { name: "Writing Helper" })
  const writingPilot = buildReviewCampaign(writer, organization.id, {
    name: "Writing pilot",
    description: "Try the helper on the letters you write every week.",
    status: "active",
  })
  return {
    ...world,
    agents: [...world.agents, writer],
    campaigns: [...world.campaigns, writingPilot],
    myCampaignRoles: { ...world.myCampaignRoles, [writingPilot.id]: ["tester"] },
    testerSessions: { ...world.testerSessions, [writingPilot.id]: [] },
    testerSurveys: { ...world.testerSurveys, [writingPilot.id]: null },
  }
}
