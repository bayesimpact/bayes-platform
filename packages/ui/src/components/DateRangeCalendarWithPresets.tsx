import { CalendarDays } from "lucide-react"
import { useCallback, useState } from "react"
import type { DateRange } from "react-day-picker"

import { isCalendarDayAfterToday } from "../lib/calendar-date-helpers"
import { getLast7DaysRange, getLast30DaysRange } from "../lib/date-range-presets"
import { cn } from "../lib/utils"
import { Button } from "../shad/button"
import { Calendar } from "../shad/calendar"
import { Card, CardContent, CardFooter } from "../shad/card"
import { Popover, PopoverContent, PopoverTrigger } from "../shad/popover"

export type DateRangePreset = "last7Days" | "last30Days" | "custom"

export type BuiltInDateRangePreset = "last7Days" | "last30Days"

export function formatDateRangeLabel(range: DateRange | undefined): string | undefined {
  if (!range?.from) {
    return undefined
  }
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
  const fromLabel = range.from.toLocaleDateString(undefined, options)
  if (!range.to) {
    return fromLabel
  }
  const toLabel = range.to.toLocaleDateString(undefined, options)
  return `${fromLabel} – ${toLabel}`
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

type RangeCalendarState = {
  range: DateRange | undefined
  activePreset: DateRangePreset
  month: Date
}

function buildInitialRangeCalendarState(defaultPreset: BuiltInDateRangePreset): RangeCalendarState {
  const range = defaultPreset === "last30Days" ? getLast30DaysRange() : getLast7DaysRange()
  const anchor = range.from ?? new Date()
  return {
    range,
    activePreset: defaultPreset,
    month: startOfMonth(anchor),
  }
}

function useDateRangeWithPresets(
  defaultPreset: BuiltInDateRangePreset,
  onRangeChange?: (range: DateRange | undefined, preset: DateRangePreset) => void,
) {
  const [state, setState] = useState<RangeCalendarState>(() =>
    buildInitialRangeCalendarState(defaultPreset),
  )

  const applyPreset = useCallback(
    (preset: BuiltInDateRangePreset) => {
      const nextRange = preset === "last30Days" ? getLast30DaysRange() : getLast7DaysRange()
      const anchor = nextRange.from ?? new Date()
      setState({
        range: nextRange,
        activePreset: preset,
        month: startOfMonth(anchor),
      })
      onRangeChange?.(nextRange, preset)
    },
    [onRangeChange],
  )

  const handleSelect = useCallback(
    (nextRange: DateRange | undefined) => {
      setState((previous) => ({
        range: nextRange,
        activePreset: "custom",
        month: nextRange?.from ? startOfMonth(nextRange.from) : previous.month,
      }))
      onRangeChange?.(nextRange, "custom")
    },
    [onRangeChange],
  )

  const handleMonthChange = useCallback((nextMonth: Date) => {
    setState((previous) => ({ ...previous, month: nextMonth }))
  }, [])

  return { state, applyPreset, handleSelect, handleMonthChange }
}

type DateRangeCalendarWithPresetsCardBodyProps = {
  state: RangeCalendarState
  applyPreset: (preset: BuiltInDateRangePreset) => void
  handleSelect: (range: DateRange | undefined) => void
  handleMonthChange: (month: Date) => void
  numberOfMonths: number
  calendarClassName?: string
}

function DateRangeCalendarWithPresetsCardBody({
  state,
  applyPreset,
  handleSelect,
  handleMonthChange,
  numberOfMonths,
  calendarClassName,
}: DateRangeCalendarWithPresetsCardBodyProps) {
  return (
    <>
      <CardContent className="px-3 pt-3 pb-0">
        <Calendar
          mode="range"
          month={state.month}
          onMonthChange={handleMonthChange}
          selected={state.range}
          onSelect={handleSelect}
          numberOfMonths={numberOfMonths}
          fixedWeeks
          endMonth={startOfMonth(new Date())}
          disabled={isCalendarDayAfterToday}
          className={cn("rounded-none border-0 bg-transparent p-0 shadow-none", calendarClassName)}
        />
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t border-border px-3 py-3 [.border-t]:pt-3">
        <Button
          type="button"
          size="sm"
          variant={state.activePreset === "last7Days" ? "default" : "outline"}
          className="min-w-0 flex-1"
          onClick={() => applyPreset("last7Days")}
        >
          Last 7 days
        </Button>
        <Button
          type="button"
          size="sm"
          variant={state.activePreset === "last30Days" ? "default" : "outline"}
          className="min-w-0 flex-1"
          onClick={() => applyPreset("last30Days")}
        >
          Last 30 days
        </Button>
      </CardFooter>
    </>
  )
}

export type DateRangeCalendarWithPresetsProps = {
  defaultPreset?: BuiltInDateRangePreset
  onRangeChange?: (range: DateRange | undefined, preset: DateRangePreset) => void
  className?: string
  numberOfMonths?: number
  calendarClassName?: string
}

export function DateRangeCalendarWithPresets({
  defaultPreset = "last7Days",
  onRangeChange,
  className,
  numberOfMonths = 2,
  calendarClassName,
}: DateRangeCalendarWithPresetsProps) {
  const { state, applyPreset, handleSelect, handleMonthChange } = useDateRangeWithPresets(
    defaultPreset,
    onRangeChange,
  )

  return (
    <Card
      className={cn("mx-auto w-fit max-w-[min(100vw-2rem,48rem)] gap-0 py-0 shadow-sm", className)}
    >
      <DateRangeCalendarWithPresetsCardBody
        state={state}
        applyPreset={applyPreset}
        handleSelect={handleSelect}
        handleMonthChange={handleMonthChange}
        numberOfMonths={numberOfMonths}
        calendarClassName={calendarClassName}
      />
    </Card>
  )
}

export type DateRangeCalendarWithPresetsPopoverProps = {
  defaultPreset?: BuiltInDateRangePreset
  onRangeChange?: (range: DateRange | undefined, preset: DateRangePreset) => void
  numberOfMonths?: number
  calendarClassName?: string
  /** Shown on the trigger when there is no range label. */
  placeholder?: string
  align?: "start" | "center" | "end"
  triggerClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DateRangeCalendarWithPresetsPopover({
  defaultPreset = "last7Days",
  onRangeChange,
  numberOfMonths = 2,
  calendarClassName,
  placeholder = "Pick a date range",
  align = "start",
  triggerClassName,
  open: controlledOpen,
  onOpenChange,
}: DateRangeCalendarWithPresetsPopoverProps) {
  const { state, applyPreset, handleSelect, handleMonthChange } = useDateRangeWithPresets(
    defaultPreset,
    onRangeChange,
  )

  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange?.(nextOpen)
      if (controlledOpen === undefined) {
        setInternalOpen(nextOpen)
      }
    },
    [controlledOpen, onOpenChange],
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("min-w-[240px] justify-start gap-2 font-normal", triggerClassName)}
        >
          <CalendarDays className="size-4 shrink-0 opacity-60" aria-hidden />
          <span className="truncate text-left">
            {formatDateRangeLabel(state.range) ?? placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-2" sideOffset={8}>
        <Card className="gap-0 border border-border bg-card py-0 shadow-sm">
          <DateRangeCalendarWithPresetsCardBody
            state={state}
            applyPreset={applyPreset}
            handleSelect={handleSelect}
            handleMonthChange={handleMonthChange}
            numberOfMonths={numberOfMonths}
            calendarClassName={calendarClassName}
          />
        </Card>
      </PopoverContent>
    </Popover>
  )
}
