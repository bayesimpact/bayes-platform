import ChartCard, { type DailyMetricPoint } from "@caseai-connect/ui/components/ChartCard"
import { DateRangeCalendarWithPresetsPopover } from "@caseai-connect/ui/components/DateRangeCalendarWithPresets"
import { getLast7DaysRange } from "@caseai-connect/ui/lib/date-range-presets"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { useCallback, useEffect, useState } from "react"
import type { DateRange } from "react-day-picker"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { AnalyticsCategoryDailyPoint } from "@/studio/features/analytics/project/analytics.models"
import {
  selectAnalyticsAvgUserQuestionsPerSessionPerDay,
  selectAnalyticsConversationsByCategoryPerDay,
  selectAnalyticsConversationsPerDay,
} from "@/studio/features/analytics/project/analytics.selectors"
import { loadProjectAnalytics } from "@/studio/features/analytics/project/analytics.thunks"
import { dateRangeToAnalyticsQueryBounds } from "@/studio/features/analytics/project/analytics-date-range"
import { ProjectCategoryChartCard } from "@/studio/features/analytics/project/components/ProjectCategoryChartCard"
import { GridHeader } from "../../common/components/grid/Grid"
import { AsyncRoute } from "../../common/routes/AsyncRoute"

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

export function ProjectAnalyticsRoute() {
  const dispatch = useAppDispatch()
  const [bounds, setBounds] = useState(getInitialAnalyticsBounds)
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all")

  useEffect(() => {
    void dispatch(
      loadProjectAnalytics({
        ...bounds,
        agentId: selectedAgentId === "all" ? undefined : selectedAgentId,
      }),
    )
  }, [dispatch, bounds, selectedAgentId])

  const conversations = useAppSelector(selectAnalyticsConversationsPerDay)
  const avgQuestions = useAppSelector(selectAnalyticsAvgUserQuestionsPerSessionPerDay)
  const conversationsByCategoryPerDay = useAppSelector(selectAnalyticsConversationsByCategoryPerDay)
  const agentsData = useAppSelector(selectAgentsData)
  const agents = ADS.isFulfilled(agentsData) ? agentsData.value : []

  return (
    <AsyncRoute data={[conversations, avgQuestions, conversationsByCategoryPerDay]}>
      {([conversationsPoints, avgQuestionsPoints, categoryPoints]) => (
        <WithData
          conversationsPoints={conversationsPoints}
          avgQuestionsPoints={avgQuestionsPoints}
          categoryPoints={categoryPoints}
          onAnalyticsRangeChange={setBounds}
          agents={agents}
          selectedAgentId={selectedAgentId}
          onAgentChange={setSelectedAgentId}
        />
      )}
    </AsyncRoute>
  )
}

function WithData({
  conversationsPoints,
  avgQuestionsPoints,
  categoryPoints,
  onAnalyticsRangeChange,
  agents,
  selectedAgentId,
  onAgentChange,
}: {
  conversationsPoints: { date: string; value: number }[]
  avgQuestionsPoints: { date: string; value: number }[]
  categoryPoints: AnalyticsCategoryDailyPoint[]
  onAnalyticsRangeChange: (nextBounds: { startAt: number; endAt: number }) => void
  agents: { id: string; name: string }[]
  selectedAgentId: string
  onAgentChange: (agentId: string) => void
}) {
  const { t } = useTranslation("analytics")
  const navigate = useNavigate()
  const getProjectRoute = useGetProjectRoute()

  const handleBack = () => navigate(getProjectRoute())

  const onRangeChange = useCallback(
    (range: DateRange | undefined) => {
      const next = dateRangeToAnalyticsQueryBounds(range)
      if (next) {
        onAnalyticsRangeChange(next)
      }
    },
    [onAnalyticsRangeChange],
  )

  return (
    <>
      <GridHeader onBack={handleBack} title={t("list.title")} description={t("list.description")} />

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-end gap-4">
          <Select value={selectedAgentId} onValueChange={onAgentChange}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={t("agentFilter.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("agentFilter.allAgents")}</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        <ProjectCategoryChartCard
          points={categoryPoints}
          allDates={conversationsPoints.map((point) => point.date)}
          selectedAgentId={selectedAgentId}
          title={t("categoriesChart.title")}
          description={t("categoriesChart.description")}
          noDataState={t("categoriesChart.noDataState")}
          uncategorizedLabel={t("categoriesChart.uncategorizedLabel")}
        />
      </div>
    </>
  )
}
