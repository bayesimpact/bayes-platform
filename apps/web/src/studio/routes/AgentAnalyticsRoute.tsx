import ChartCard, { type DailyMetricPoint } from "@caseai-connect/ui/components/ChartCard"
import { DateRangeCalendarWithPresetsPopover } from "@caseai-connect/ui/components/DateRangeCalendarWithPresets"
import { getLast7DaysRange } from "@caseai-connect/ui/lib/date-range-presets"
import { useCallback, useEffect, useState } from "react"
import type { DateRange } from "react-day-picker"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import type { Agent } from "@/common/features/agents/agents.models"
import {
  selectCurrentAgentData,
  selectCurrentAgentId,
} from "@/common/features/agents/agents.selectors"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { useAbility } from "@/common/hooks/use-ability"
import { useGetPath } from "@/common/hooks/use-build-path"
import { NotFoundRoute } from "@/common/routes/NotFoundRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import {
  selectAgentAnalyticsAvgUserQuestionsPerSessionPerDay,
  selectAgentAnalyticsConversationsByCategoryPerDay,
  selectAgentAnalyticsConversationsPerDay,
} from "@/studio/features/analytics/agent/agent-analytics.selectors"
import { loadAgentAnalytics } from "@/studio/features/analytics/agent/agent-analytics.thunks"
import type { AnalyticsCategoryDailyPoint } from "@/studio/features/analytics/project/analytics.models"
import { dateRangeToAnalyticsQueryBounds } from "@/studio/features/analytics/project/analytics-date-range"
import { ProjectCategoryChartCard } from "@/studio/features/analytics/project/components/ProjectCategoryChartCard"
import { AsyncRoute } from "../../common/routes/AsyncRoute"
import { ErrorRoute } from "../../common/routes/ErrorRoute"

function sumDailyMetricValues(series: DailyMetricPoint[]): number {
  return series.reduce((sum, point) => sum + point.value, 0)
}

function meanDailyMetricValues(series: DailyMetricPoint[]): number {
  if (series.length === 0) {
    return 0
  }
  return sumDailyMetricValues(series) / series.length
}

function getInitialAnalyticsBounds() {
  const initialRange = getLast7DaysRange()
  return dateRangeToAnalyticsQueryBounds({
    from: initialRange.from,
    to: initialRange.to,
  })!
}

export function AgentAnalyticsRoute() {
  const agentId = useAppSelector(selectCurrentAgentId)
  const agent = useAppSelector(selectCurrentAgentData)
  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agentId })

  if (!agentId) return <ErrorRoute error="Missing valid agent ID" />

  if (!canManageAgent) return <NotFoundRoute />
  return (
    <AsyncRoute data={[agent]}>{([agentValue]) => <WithAgent agent={agentValue} />}</AsyncRoute>
  )
}

function WithAgent({ agent }: { agent: Agent }) {
  const dispatch = useAppDispatch()
  const [bounds, setBounds] = useState(getInitialAnalyticsBounds)

  useEffect(() => {
    void dispatch(loadAgentAnalytics(bounds))
  }, [dispatch, bounds])

  const conversations = useAppSelector(selectAgentAnalyticsConversationsPerDay)
  const avgQuestions = useAppSelector(selectAgentAnalyticsAvgUserQuestionsPerSessionPerDay)
  const conversationsByCategoryPerDay = useAppSelector(
    selectAgentAnalyticsConversationsByCategoryPerDay,
  )

  return (
    <AsyncRoute data={[conversations, avgQuestions, conversationsByCategoryPerDay]}>
      {([conversationsPoints, avgQuestionsPoints, categoryPoints]) => (
        <WithData
          agent={agent}
          conversationsPoints={conversationsPoints}
          avgQuestionsPoints={avgQuestionsPoints}
          categoryPoints={categoryPoints}
          onAnalyticsRangeChange={setBounds}
        />
      )}
    </AsyncRoute>
  )
}

function WithData({
  agent,
  conversationsPoints,
  avgQuestionsPoints,
  categoryPoints,
  onAnalyticsRangeChange,
}: {
  agent: Agent
  conversationsPoints: { date: string; value: number }[]
  avgQuestionsPoints: { date: string; value: number }[]
  categoryPoints: AnalyticsCategoryDailyPoint[]
  onAnalyticsRangeChange: (nextBounds: { startAt: number; endAt: number }) => void
}) {
  const { t } = useTranslation("agentAnalytics")
  const navigate = useNavigate()
  const { getPath } = useGetPath()

  const handleBack = () => {
    const path = getPath("agent")
    navigate(path)
  }

  const onRangeChange = useCallback(
    (range: DateRange | undefined) => {
      const next = dateRangeToAnalyticsQueryBounds(range)
      if (next) {
        onAnalyticsRangeChange(next)
      }
    },
    [onAnalyticsRangeChange],
  )

  const Icon = getAgentIcon(agent.type)
  const hasConfiguredCategoryTaxonomy = agent.hasCategories ?? false

  return (
    <>
      <GridHeader
        onBack={handleBack}
        title={t("list.pageTitle")}
        description={
          <>
            <div className="capitalize-first">{agent.name}</div> •
            <div className="capitalize-first">{t(`agent:create.typeDialog.${agent.type}`)}</div>
            <Icon />
          </>
        }
      />

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-end gap-4">
          <DateRangeCalendarWithPresetsPopover
            defaultPreset="last7Days"
            onRangeChange={onRangeChange}
            placeholder={t("dateRangePlaceholder")}
            align="end"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-2">
          <ChartCard
            title={t("conversationsChart.title")}
            description={t("conversationsChart.description")}
            metricLabel={t("conversationsChart.metricLabel")}
            data={conversationsPoints}
            getSummaryValue={sumDailyMetricValues}
          />
          <ChartCard
            title={t("avgQuestionsChart.title")}
            description={t("avgQuestionsChart.description")}
            metricLabel={t("avgQuestionsChart.metricLabel")}
            data={avgQuestionsPoints}
            getSummaryValue={meanDailyMetricValues}
          />
        </div>

        {hasConfiguredCategoryTaxonomy ? (
          <ProjectCategoryChartCard
            points={categoryPoints}
            allDates={conversationsPoints.map((point) => point.date)}
            selectedAgentId={agent.id}
            title={t("categoriesChart.title")}
            description={t("categoriesChart.description")}
            noDataState={t("categoriesChart.noDataState")}
            uncategorizedLabel={t("categoriesChart.uncategorizedLabel")}
          />
        ) : null}
      </div>
    </>
  )
}
