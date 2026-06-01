import type { DayPickerProps } from "react-day-picker"
import { DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "../lib/utils"

function Calendar({ className, classNames, showOutsideDays = true, ...props }: DayPickerProps) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "rounded-lg border border-border bg-card p-3 text-sm text-card-foreground shadow-sm",
        className,
      )}
      classNames={{
        ...defaultClassNames,
        ...classNames,
        day: cn(defaultClassNames.day, "text-xs font-normal leading-none", classNames?.day),
        day_button: cn(
          defaultClassNames.day_button,
          "text-xs font-medium tabular-nums leading-none",
          classNames?.day_button,
        ),
        weekday: cn(
          defaultClassNames.weekday,
          "text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground",
          classNames?.weekday,
        ),
        month_caption: cn(
          defaultClassNames.month_caption,
          "!text-sm !font-semibold leading-none",
          classNames?.month_caption,
        ),
        caption_label: cn(
          defaultClassNames.caption_label,
          "text-sm font-semibold",
          classNames?.caption_label,
        ),
        button_next: cn(defaultClassNames.button_next, "text-primary", classNames?.button_next),
        button_previous: cn(
          defaultClassNames.button_previous,
          "text-primary",
          classNames?.button_previous,
        ),
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
