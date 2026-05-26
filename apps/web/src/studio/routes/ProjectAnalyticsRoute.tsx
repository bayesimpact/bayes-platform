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
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
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

  // FIXME: useMount
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

  return (
    <AsyncRoute data={[agentsData, conversations, avgQuestions, conversationsByCategoryPerDay]}>
      <WithData
        onAnalyticsRangeChange={setBounds}
        selectedAgentId={selectedAgentId}
        onAgentChange={setSelectedAgentId}
      />
    </AsyncRoute>
  )
}

function WithData({
  onAnalyticsRangeChange,
  selectedAgentId,
  onAgentChange,
}: {
  onAnalyticsRangeChange: (nextBounds: { startAt: number; endAt: number }) => void
  selectedAgentId: string
  onAgentChange: (agentId: string) => void
}) {
  const agents = useValue(selectAgentsData)
  const conversationsPoints = useValue(selectAnalyticsConversationsPerDay)
  const avgQuestionsPoints = useValue(selectAnalyticsAvgUserQuestionsPerSessionPerDay)
  const categoryPoints = useValue(selectAnalyticsConversationsByCategoryPerDay)
  const { t } = useTranslation("analytics")
  const navigate = useNavigate()
  const projectRoute = useGetProjectRoute()

  const handleBack = () => navigate(projectRoute)

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
