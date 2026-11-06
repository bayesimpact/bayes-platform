import ChartCard from "@caseai-connect/ui/components/ChartCard"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useTranslation } from "react-i18next"
import { buildStoryDates } from "@/stories/analytics/helpers"
import { EmptySessionsNotice } from "@/studio/features/analytics/components/EmptySessionsNotice"
import { analyticsDailyPointFactory } from "@/studio/features/analytics/project/analytics.factory"

const DATES = buildStoryDates("2026-05-10", 7)

type ScenarioArgs = {
  conversationsPerDay: number[]
  emptySessionsPerDay: number[]
}

/** The notice in its place on the analytics page: between the date range and the charts. */
function AnalyticsPageScene({ conversationsPerDay, emptySessionsPerDay }: ScenarioArgs) {
  const { t } = useTranslation("agentAnalytics")
  const conversationPoints = DATES.map((date, dayIndex) =>
    analyticsDailyPointFactory.build({ date, value: conversationsPerDay[dayIndex] ?? 0 }),
  )
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

  return (
    <div className="flex flex-col gap-6 p-6">
      <EmptySessionsNotice
        conversationTotal={sum(conversationsPerDay)}
        emptySessionTotal={sum(emptySessionsPerDay)}
      />
      <div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title={t("conversationsChart.title")}
          description={t("conversationsChart.description")}
          metricLabel={t("conversationsChart.metricLabel")}
          data={conversationPoints}
        />
        <ChartCard
          title={t("avgQuestionsChart.title")}
          description={t("avgQuestionsChart.description")}
          metricLabel={t("avgQuestionsChart.metricLabel")}
          data={DATES.map((date) => analyticsDailyPointFactory.build({ date, value: 2 }))}
          getSummaryValue={() => 2}
        />
      </div>
    </div>
  )
}

const meta = {
  title: "analytics/EmptySessionsNotice",
  component: AnalyticsPageScene,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AnalyticsPageScene>

export default meta
type Story = StoryObj<typeof meta>

/** A few visitors opened the chat and left: a discreet note, no warning. */
export const FewEmptySessions: Story = {
  args: {
    conversationsPerDay: [12, 15, 9, 14, 18, 11, 13],
    emptySessionsPerDay: [1, 0, 2, 1, 0, 1, 0],
  },
}

/** An integration opens a session on every page load: the warning names the likely cause. */
export const MostlyEmptySessions: Story = {
  args: {
    conversationsPerDay: [6, 7, 5, 8, 0, 0, 6],
    emptySessionsPerDay: [540, 580, 512, 519, 0, 0, 210],
  },
}

/** No empty session: the page shows nothing more than today. */
export const NoEmptySessions: Story = {
  args: {
    conversationsPerDay: [12, 15, 9, 14, 18, 11, 13],
    emptySessionsPerDay: [0, 0, 0, 0, 0, 0, 0],
  },
}
