import type {
  PaginatedBackofficeAgents,
  PaginatedBackofficeOrganizations,
  PaginatedBackofficeProjects,
  PaginatedBackofficeUsers,
  TermsDocuments,
} from "@/backoffice/features/backoffice/backoffice.models"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import type { ExtractionAgentSessions } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.models"
import type {
  FormAgentSession,
  FormSubSession,
} from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"
import type { AgentSessionMessage } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import type { Agent } from "@/common/features/agents/agents.models"
import type { User } from "@/common/features/me/me.models"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import type { Organization } from "@/common/features/organizations/organizations.models"
import type { Project } from "@/common/features/projects/projects.models"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type {
  EvaluationConversationDataset,
  PaginatedEvaluationConversationDatasetRecords,
} from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.models"
import type {
  EvaluationConversationRun,
  EvaluationConversationRunRecord,
  PaginatedEvaluationConversationRunRecords,
} from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.models"
import type { AgentMembership } from "@/studio/features/agent-memberships/agent-memberships.models"
import type { AgentMessageFeedback } from "@/studio/features/agent-message-feedback/agent-message-feedback.models"
import type { AgentSubAgent } from "@/studio/features/agent-sub-agents/agent-sub-agents.models"
import type {
  AnalyticsCategoryDailyPoint,
  AnalyticsDailyPoint,
} from "@/studio/features/analytics/project/analytics.models"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import type { Document } from "@/studio/features/documents/documents.models"
import type { PendingInvitations } from "@/studio/features/invitations/invitations.models"
import type { McpServer } from "@/studio/features/mcp-servers/mcp-servers.models"
import type {
  ProjectMemberAgent,
  ProjectMembership,
} from "@/studio/features/project-memberships/project-memberships.models"
import type { ResourceLibrary } from "@/studio/features/resource-libraries/resource-libraries.models"
import type { CampaignReport } from "@/studio/features/review-campaigns/reports/reports.models"
import type {
  ReviewCampaign,
  ReviewCampaignDetail,
} from "@/studio/features/review-campaigns/review-campaigns.models"
import type {
  MyReviewCampaign,
  MyTesterSessionSummary,
  TesterCampaignSurvey,
  TesterContext,
} from "@/tester/features/review-campaigns/tester.models"
import type { StoryPreloadedState } from "./decorators"

/**
 * AsyncData factories. Use these to build the `{ status, error, value }` envelopes
 * around domain values when seeding slice state.
 */
export const ads = {
  fulfilled<T>(value: T): AsyncData<T> {
    return { status: ADS.Fulfilled, error: null, value }
  },
  loading<T>(): AsyncData<T> {
    return { status: ADS.Loading, error: null, value: null }
  },
  errored<T>(error: string): AsyncData<T> {
    return { status: ADS.Error, error, value: null }
  },
  uninitialized<T>(): AsyncData<T> {
    return defaultAsyncData as AsyncData<T>
  },
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function deepMergeInternal(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a }
  for (const [key, value] of Object.entries(b)) {
    if (value === undefined) continue
    const current = a[key]
    out[key] =
      isPlainObject(current) && isPlainObject(value) ? deepMergeInternal(current, value) : value
  }
  return out
}

/**
 * Deep-merge multiple preloaded-state fragments into one. Later fragments win over earlier ones.
 */
export function mergeSeeds(...seeds: StoryPreloadedState[]): StoryPreloadedState {
  return seeds.reduce<StoryPreloadedState>(
    (acc, seed) =>
      deepMergeInternal(
        acc as Record<string, unknown>,
        seed as Record<string, unknown>,
      ) as StoryPreloadedState,
    {} as StoryPreloadedState,
  )
}

/**
 * Composable seed helpers. Each returns a `DeepPartial<RootState>` that can be merged via
 * `mergeSeeds(...)` or passed alone as `withRedux({ state })`.
 *
 * Stories that need to seed a slice not covered here can pass a raw fragment directly:
 *   `withRedux({ state: { someSlice: { ... } } })`
 */
export const seed = {
  me(user: User): StoryPreloadedState {
    return { me: { data: ads.fulfilled(user) } }
  },

  pendingInvitations(invitations: PendingInvitations): StoryPreloadedState {
    return { me: { pendingInvitations: ads.fulfilled(invitations) } }
  },

  organizations(
    organizations: Organization[],
    options: { currentId?: string | null } = {},
  ): StoryPreloadedState {
    const currentId = options.currentId ?? organizations[0]?.id ?? null
    return mergeSeeds(
      { organizations: { data: ads.fulfilled(organizations) } },
      { currentIds: { organizationId: currentId } },
    )
  },

  projects(projects: Project[], options: { currentId?: string | null } = {}): StoryPreloadedState {
    const currentId = options.currentId ?? projects[0]?.id ?? null
    return mergeSeeds(
      { projects: { data: ads.fulfilled(projects) } },
      { currentIds: { projectId: currentId } },
    )
  },

  /**
   * Shortcut: seed a single current project AND a derived organization that owns it.
   * Equivalent to merging `seed.projects([project], { currentId: project.id })` with
   * `seed.organizations([{ id: project.organizationId, ... }], { currentId: project.organizationId })`.
   */
  currentProject(project: Project): StoryPreloadedState {
    return mergeSeeds(
      seed.projects([project], { currentId: project.id }),
      seed.organizations(
        [
          organizationFactory.build({
            id: project.organizationId,
          }),
        ],
        { currentId: project.organizationId },
      ),
    )
  },

  agents(agents: Agent[], options: { currentId?: string | null } = {}): StoryPreloadedState {
    const currentId = options.currentId ?? null
    return mergeSeeds(
      { agents: { data: ads.fulfilled(agents) } },
      { currentIds: { agentId: currentId } },
    )
  },

  currentReviewCampaignId(id: string | null): StoryPreloadedState {
    return { currentIds: { reviewCampaignId: id } }
  },

  currentMembershipId(id: string | null): StoryPreloadedState {
    return { currentIds: { membershipId: id } }
  },

  currentResourceLibraryId(id: string | null): StoryPreloadedState {
    return { currentIds: { resourceLibraryId: id } }
  },

  currentResourceId(id: string | null): StoryPreloadedState {
    return { currentIds: { resourceId: id } }
  },

  campaignReport(report: CampaignReport): StoryPreloadedState {
    return { reviewCampaignsReports: { report: ads.fulfilled(report) } }
  },

  conversationAgentSessions(
    sessionsByAgentId: Record<string, ConversationAgentSession[]>,
  ): StoryPreloadedState {
    const data = Object.fromEntries(
      Object.entries(sessionsByAgentId).map(([agentId, sessions]) => [
        agentId,
        ads.fulfilled(sessions),
      ]),
    )
    return { conversationAgentSessions: { data } }
  },

  formAgentSessions(sessionsByAgentId: Record<string, FormAgentSession[]>): StoryPreloadedState {
    const data = Object.fromEntries(
      Object.entries(sessionsByAgentId).map(([agentId, sessions]) => [
        agentId,
        ads.fulfilled(sessions),
      ]),
    )
    return { formAgentSessions: { data } }
  },

  formSubSessions(
    subSessionsByParentSessionId: Record<string, FormSubSession[]>,
  ): StoryPreloadedState {
    const subSessions = Object.fromEntries(
      Object.entries(subSessionsByParentSessionId).map(([parentSessionId, subSessionList]) => [
        parentSessionId,
        ads.fulfilled(subSessionList),
      ]),
    )
    return { formAgentSessions: { subSessions } }
  },

  extractionAgentSessions(
    sessionsByAgentId: Record<string, ExtractionAgentSessions>,
  ): StoryPreloadedState {
    const data = Object.fromEntries(
      Object.entries(sessionsByAgentId).map(([agentId, sessions]) => [
        agentId,
        { isExtracting: false, sessions: ads.fulfilled(sessions) },
      ]),
    )
    return { extractionAgentSessions: { data } }
  },

  currentAgentSessionId(id: string | null): StoryPreloadedState {
    return { currentIds: { agentSessionId: id } }
  },

  agentSessionMessages(messages: AgentSessionMessage[]): StoryPreloadedState {
    return { agentSessionMessages: { data: ads.fulfilled(messages) } }
  },

  studio: {
    documents(documents: Document[]): StoryPreloadedState {
      return { documents: { data: ads.fulfilled(documents) } }
    },

    documentTags(documentTags: DocumentTag[]): StoryPreloadedState {
      return { documentTags: { data: ads.fulfilled(documentTags) } }
    },

    mcpServers(mcpServers: McpServer[]): StoryPreloadedState {
      return { mcpServers: { data: ads.fulfilled(mcpServers) } }
    },

    resourceLibraries(resourceLibraries: ResourceLibrary[]): StoryPreloadedState {
      return { resourceLibraries: { data: ads.fulfilled(resourceLibraries) } }
    },

    projectAnalytics(value: {
      conversationsPerDay: AnalyticsDailyPoint[]
      avgUserQuestionsPerSessionPerDay: AnalyticsDailyPoint[]
      conversationsByCategoryPerDay: AnalyticsCategoryDailyPoint[]
    }): StoryPreloadedState {
      return {
        projectAnalytics: {
          conversationsPerDay: ads.fulfilled(value.conversationsPerDay),
          avgUserQuestionsPerSessionPerDay: ads.fulfilled(value.avgUserQuestionsPerSessionPerDay),
          conversationsByCategoryPerDay: ads.fulfilled(value.conversationsByCategoryPerDay),
        },
      }
    },

    agentAnalytics(value: {
      conversationsPerDay: AnalyticsDailyPoint[]
      avgUserQuestionsPerSessionPerDay: AnalyticsDailyPoint[]
      conversationsByCategoryPerDay: AnalyticsCategoryDailyPoint[]
    }): StoryPreloadedState {
      return {
        agentAnalytics: {
          conversationsPerDay: ads.fulfilled(value.conversationsPerDay),
          avgUserQuestionsPerSessionPerDay: ads.fulfilled(value.avgUserQuestionsPerSessionPerDay),
          conversationsByCategoryPerDay: ads.fulfilled(value.conversationsByCategoryPerDay),
        },
      }
    },

    reviewCampaigns(campaigns: ReviewCampaign[]): StoryPreloadedState {
      return { reviewCampaigns: { data: ads.fulfilled(campaigns) } }
    },

    selectedReviewCampaignDetail(detail: ReviewCampaignDetail): StoryPreloadedState {
      return { reviewCampaigns: { selectedDetail: ads.fulfilled(detail) } }
    },

    agentMemberships(memberships: AgentMembership[]): StoryPreloadedState {
      return { agentMemberships: { data: ads.fulfilled(memberships) } }
    },

    projectMemberships(memberships: ProjectMembership[]): StoryPreloadedState {
      return { projectMemberships: { data: ads.fulfilled(memberships) } }
    },

    pendingInvitations(invitations: PendingInvitations): StoryPreloadedState {
      return { projectMemberships: { pendingInvitations: ads.fulfilled(invitations) } }
    },

    projectMemberAgents(memberAgents: ProjectMemberAgent[]): StoryPreloadedState {
      return { projectMemberships: { memberAgents: ads.fulfilled(memberAgents) } }
    },

    agentMessageFeedbacks(
      feedbacksByAgentId: Record<string, AgentMessageFeedback[]>,
    ): StoryPreloadedState {
      return { agentMessageFeedback: { data: ads.fulfilled(feedbacksByAgentId) } }
    },

    agentSubAgents(subAgents: AgentSubAgent[]): StoryPreloadedState {
      return { agentSubAgents: { data: ads.fulfilled(subAgents) } }
    },

    agentHistory(versions: Agent[]): StoryPreloadedState {
      return { agentHistory: { data: ads.fulfilled(versions) } }
    },
  },

  backoffice: {
    organizations(organizations: PaginatedBackofficeOrganizations): StoryPreloadedState {
      return {
        backoffice: {
          organizations: ads.fulfilled(organizations),
          organizationsQuery: {
            page: organizations.page,
            limit: organizations.limit,
            search: "",
          },
        },
      }
    },

    agents(agents: PaginatedBackofficeAgents): StoryPreloadedState {
      return {
        backoffice: {
          agents: ads.fulfilled(agents),
          agentsQuery: { page: agents.page, limit: agents.limit, search: "" },
        },
      }
    },

    projects(projects: PaginatedBackofficeProjects): StoryPreloadedState {
      return {
        backoffice: {
          projects: ads.fulfilled(projects),
          projectsQuery: { page: projects.page, limit: projects.limit, search: "" },
        },
      }
    },

    users(users: PaginatedBackofficeUsers): StoryPreloadedState {
      return {
        backoffice: {
          users: ads.fulfilled(users),
          usersQuery: { page: users.page, limit: users.limit, search: "" },
        },
      }
    },

    termsDocuments(termsDocuments: TermsDocuments): StoryPreloadedState {
      return { backoffice: { termsDocuments: ads.fulfilled(termsDocuments) } }
    },
  },

  eval: {
    conversationDatasets(
      datasets: EvaluationConversationDataset[],
      options: { currentId?: string | null } = {},
    ): StoryPreloadedState {
      const currentId = options.currentId ?? null
      return mergeSeeds(
        { conversationDatasets: { data: ads.fulfilled(datasets) } },
        { currentIds: { datasetId: currentId } },
      )
    },

    conversationDatasetRecords(
      records: PaginatedEvaluationConversationDatasetRecords,
    ): StoryPreloadedState {
      return { conversationDatasets: { records: ads.fulfilled(records) } }
    },

    conversationRuns(
      runs: EvaluationConversationRun[],
      options: { currentId?: string | null } = {},
    ): StoryPreloadedState {
      const currentId = options.currentId ?? null
      const currentRun = runs.find((run) => run.id === currentId)
      return mergeSeeds(
        { conversationRuns: { data: ads.fulfilled(runs), currentRunId: currentId } },
        currentRun ? { conversationRuns: { currentRun: ads.fulfilled(currentRun) } } : {},
        { currentIds: { runId: currentId } },
      )
    },

    conversationRunRecords(
      records: PaginatedEvaluationConversationRunRecords,
    ): StoryPreloadedState {
      return {
        conversationRuns: {
          currentRunRecords: ads.fulfilled(records),
          currentRecordsQuery: { page: records.page, limit: records.limit },
        },
      }
    },

    conversationRunsComparison(
      recordsByRunId: Record<string, EvaluationConversationRunRecord[]>,
    ): StoryPreloadedState {
      return {
        conversationRuns: {
          // Seed the run ids too so the route's setComparisonRunIds sees the
          // same comparison and does not reset the seeded records on mount.
          comparisonRunIds: Object.keys(recordsByRunId),
          comparisonRecords: ads.fulfilled(recordsByRunId),
        },
      }
    },
  },

  tester: {
    myCampaigns(campaigns: MyReviewCampaign[]): StoryPreloadedState {
      return { reviewCampaignsTester: { myCampaigns: ads.fulfilled(campaigns) } }
    },

    context(context: TesterContext): StoryPreloadedState {
      return { reviewCampaignsTester: { testerContext: ads.fulfilled(context) } }
    },

    campaignSurvey(survey: TesterCampaignSurvey | null): StoryPreloadedState {
      return { reviewCampaignsTester: { campaignSurvey: ads.fulfilled(survey) } }
    },

    campaignSessions(sessions: MyTesterSessionSummary[]): StoryPreloadedState {
      return { reviewCampaignsTester: { campaignSessions: ads.fulfilled(sessions) } }
    },
  },
}
