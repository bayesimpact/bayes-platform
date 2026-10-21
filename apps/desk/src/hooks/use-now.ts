import { useEffect, useState } from "react"

/**
 * The current time, which moves every `intervalInMilliseconds` while `isTicking`, so a page can
 * show a running clock. Time is outside React, which an effect follows.
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
