import { useEffect, useState } from "react"

/** How often a relative time ("5 minutes ago") moves: it counts in minutes. */
export const RELATIVE_TIME_INTERVAL_IN_MILLISECONDS = 60 * 1000

/**
 * The current time, which moves every `intervalInMilliseconds` while `isTicking`, so a page can
 * show a running clock. Time is outside React, which an effect follows. A page reads it once and
 * passes `now` down, so all its times agree.
 */
export function useNow(intervalInMilliseconds: number, isTicking: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isTicking) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), intervalInMilliseconds)
    return () => window.clearInterval(timer)
  }, [intervalInMilliseconds, isTicking])
  return now
}
