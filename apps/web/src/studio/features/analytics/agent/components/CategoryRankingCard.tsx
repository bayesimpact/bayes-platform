import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { cn } from "@caseai-connect/ui/utils"
import { ChevronDownIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { AnalyticsCategoryDailyPoint } from "../../project/analytics.models"
import { buildCategoryRanking, type CategoryRankingRow } from "../category-ranking"

const CATEGORY_COLOR = "var(--color-chart-primary)"
const UNCATEGORIZED_COLOR = "var(--muted-foreground)"

function getRowColor(row: CategoryRankingRow): string {
  return row.isUncategorized ? UNCATEGORIZED_COLOR : CATEGORY_COLOR
}

function formatDateTick(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatTooltipDate(labelValue: React.ReactNode): string {
  return new Date(String(labelValue)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatShare(share: number): string {
  return share.toLocaleString(undefined, { style: "percent", maximumFractionDigits: 0 })
}

export function CategoryRankingCard({
  points,
  allDates,
  conversationTotal,
  title,
  description,
  noDataState,
  uncategorizedLabel,
}: {
  points: AnalyticsCategoryDailyPoint[]
  allDates: string[]
  /** Conversations of the period, the base of the share column. */
  conversationTotal?: number
  title: string
  description: string
  noDataState: string
  uncategorizedLabel: string
}) {
  const { t } = useTranslation("agentAnalytics")
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const ranking = buildCategoryRanking({
    points,
    allDates,
    conversationTotal,
    uncategorizedLabel,
  })
  const maxShare = Math.max(
    ...ranking.categories.map((row) => row.share),
    ranking.uncategorized?.share ?? 0,
  )

  const toggleRow = (key: string) =>
    setExpandedKey((currentKey) => (currentKey === key ? null : key))

  const renderRow = (row: CategoryRankingRow) => (
    <CategoryRow
      key={row.key}
      row={row}
      maxShare={maxShare}
      isExpanded={expandedKey === row.key}
      onToggle={() => toggleRow(row.key)}
    />
  )

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-2 py-2 sm:px-4">
        {ranking.categories.length === 0 && !ranking.uncategorized ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">{noDataState}</div>
        ) : (
          <div className="flex flex-col">
            <div
              className={cn(
                "grid items-center gap-4 px-3 py-2 text-xs text-muted-foreground",
                GRID_COLUMNS,
              )}
            >
              <span>{t("categoriesChart.columns.category")}</span>
              <span className="text-right">{t("categoriesChart.columns.conversations")}</span>
              <span className="text-right">{t("categoriesChart.columns.share")}</span>
              <span className="hidden sm:block">{t("categoriesChart.columns.trend")}</span>
              <span />
            </div>
            {ranking.categories.map(renderRow)}
            {ranking.uncategorized && (
              <div className="mt-1 border-t pt-1">{renderRow(ranking.uncategorized)}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const GRID_COLUMNS =
  "grid-cols-[minmax(0,1fr)_4.5rem_3.5rem_1rem] sm:grid-cols-[minmax(0,1fr)_6rem_4rem_8rem_1rem]"

function CategoryRow({
  row,
  maxShare,
  isExpanded,
  onToggle,
}: {
  row: CategoryRankingRow
  maxShare: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const color = getRowColor(row)
  const barWidth = maxShare === 0 ? 0 : (row.share / maxShare) * 100

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className={cn(
          "grid w-full items-center gap-4 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
          GRID_COLUMNS,
          isExpanded && "bg-muted/50",
        )}
      >
        <span className="flex min-w-0 flex-col gap-1.5">
          <span
            className={cn("truncate", row.isUncategorized && "text-muted-foreground")}
            title={row.label}
          >
            {row.label}
          </span>
          <span className="h-1 w-full rounded-full bg-muted">
            <span
              className="block h-1 rounded-full"
              style={{ width: `${barWidth}%`, backgroundColor: color }}
            />
          </span>
        </span>
        <span className="text-right font-medium tabular-nums">{row.total.toLocaleString()}</span>
        <span className="text-right tabular-nums text-muted-foreground">
          {formatShare(row.share)}
        </span>
        <span className="hidden h-7 sm:block" aria-hidden>
          <Sparkline row={row} color={color} />
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            isExpanded && "rotate-180",
          )}
        />
      </button>
      {isExpanded && <CategoryDailyChart row={row} color={color} />}
    </div>
  )
}

function Sparkline({ row, color }: { row: CategoryRankingRow; color: string }) {
  const gradientId = `sparkline-${row.key.replace(/[^a-zA-Z0-9_-]/g, "")}`
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={row.dailySeries} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[0, "dataMax"]} />
        <Area
          type="linear"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function CategoryDailyChart({ row, color }: { row: CategoryRankingRow; color: string }) {
  const { t } = useTranslation("agentAnalytics")
  return (
    <div className="h-44 px-1 pt-2 pb-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={row.dailySeries} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={formatDateTick}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={40}
            allowDecimals={false}
            domain={[0, "auto"]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            formatter={(value) => [
              Number(value).toLocaleString(),
              t("categoriesChart.columns.conversations"),
            ]}
            labelFormatter={formatTooltipDate}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
