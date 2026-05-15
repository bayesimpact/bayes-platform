import type { Agent } from "@/common/features/agents/agents.models"
import type { User } from "@/common/features/me/me.models"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import type { Organization } from "@/common/features/organizations/organizations.models"
import type { Project } from "@/common/features/projects/projects.models"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type {
  AnalyticsCategoryDailyPoint,
  AnalyticsDailyPoint,
} from "@/studio/features/analytics/project/analytics.models"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import type { Document } from "@/studio/features/documents/documents.models"
import type { EvaluationReport } from "@/studio/features/evaluation-reports/evaluation-reports.models"
import type { Evaluation } from "@/studio/features/evaluations/evaluations.models"
import type {
  ReviewCampaign,
  ReviewCampaignDetail,
} from "@/studio/features/review-campaigns/review-campaigns.models"
import type {
  MyReviewCampaign,
  TesterCampaignSurvey,
  TesterContext,
} from "@/tester/features/review-campaigns/tester.models"
import type { LocalSessionSummary } from "@/tester/features/review-campaigns/tester.slice"
import type { StoryPreloadedState } from "./decorators/with-redux"

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

  organizations(
    organizations: Organization[],
    options: { currentId?: string | null } = {},
  ): StoryPreloadedState {
    return {
      organizations: {
        data: ads.fulfilled(organizations),
        currentOrganizationId: options.currentId ?? organizations[0]?.id ?? null,
      },
    }
  },

  projects(projects: Project[], options: { currentId?: string | null } = {}): StoryPreloadedState {
    return {
      projects: {
        data: ads.fulfilled(projects),
        currentProjectId: options.currentId ?? projects[0]?.id ?? null,
      },
    }
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
    return {
      agents: {
        data: ads.fulfilled(agents),
        currentAgentId: options.currentId ?? null,
      },
    }
  },

  studio: {
    documents(documents: Document[]): StoryPreloadedState {
      return { studio: { documents: { data: ads.fulfilled(documents) } } }
    },

    documentTags(documentTags: DocumentTag[]): StoryPreloadedState {
      return { studio: { documentTags: { data: ads.fulfilled(documentTags) } } }
    },

    evaluations(evaluations: Evaluation[]): StoryPreloadedState {
      return { studio: { evaluations: { data: ads.fulfilled(evaluations) } } }
    },

    evaluationReports(
      reportsByEvaluationId: Record<string, EvaluationReport[]>,
    ): StoryPreloadedState {
      return { studio: { evaluationReports: { data: ads.fulfilled(reportsByEvaluationId) } } }
    },

    projectAnalytics(value: {
      conversationsPerDay: AnalyticsDailyPoint[]
      avgUserQuestionsPerSessionPerDay: AnalyticsDailyPoint[]
      conversationsByCategoryPerDay: AnalyticsCategoryDailyPoint[]
    }): StoryPreloadedState {
      return {
        studio: {
          projectAnalytics: {
            conversationsPerDay: ads.fulfilled(value.conversationsPerDay),
            avgUserQuestionsPerSessionPerDay: ads.fulfilled(value.avgUserQuestionsPerSessionPerDay),
            conversationsByCategoryPerDay: ads.fulfilled(value.conversationsByCategoryPerDay),
          },
        },
      }
    },

    reviewCampaigns(campaigns: ReviewCampaign[]): StoryPreloadedState {
      return { studio: { reviewCampaigns: { data: ads.fulfilled(campaigns) } } }
    },

    selectedReviewCampaignDetail(detail: ReviewCampaignDetail): StoryPreloadedState {
      return { studio: { reviewCampaigns: { selectedDetail: ads.fulfilled(detail) } } }
    },
  },

  tester: {
    myCampaigns(campaigns: MyReviewCampaign[]): StoryPreloadedState {
      return { tester: { reviewCampaignsTester: { myCampaigns: ads.fulfilled(campaigns) } } }
    },

    context(context: TesterContext): StoryPreloadedState {
      return { tester: { reviewCampaignsTester: { selectedContext: ads.fulfilled(context) } } }
    },

    surveyByCampaignId(byCampaignId: Record<string, TesterCampaignSurvey>): StoryPreloadedState {
      return {
        tester: { reviewCampaignsTester: { selectedSurveyByCampaignId: byCampaignId } },
      }
    },

    localSessionsByCampaignId(
      byCampaignId: Record<string, LocalSessionSummary[]>,
    ): StoryPreloadedState {
      return { tester: { reviewCampaignsTester: { mySessionsByCampaignId: byCampaignId } } }
    },
  },
}
