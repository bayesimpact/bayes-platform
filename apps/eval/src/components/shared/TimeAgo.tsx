import { RELATIVE_TIME_INTERVAL_IN_MILLISECONDS, useNow } from "@/hooks/use-now"
import { RelativeTime } from "./RelativeTime"

export type TimeAgoProps = {
  /** When it happened, in epoch milliseconds. */
  moment: number
  className?: string
}

/**
 * When something happened, as "5 minutes ago", with the full date and time on hover: how the app
 * shows a date in a table or under a title. It follows the clock by itself, a minute at a time;
 * a list that already holds the current time gives it to `RelativeTime`.
 */
export function TimeAgo({ moment, className }: TimeAgoProps) {
  const now = useNow(RELATIVE_TIME_INTERVAL_IN_MILLISECONDS, true)
  return <RelativeTime moment={moment} now={now} className={className} />
}
