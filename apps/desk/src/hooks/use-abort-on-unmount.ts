import { useEffect, useRef } from "react"

/**
 * Gives each new request of a component its own `AbortSignal`, and aborts the last one when the
 * component goes away: an upload stops when the person leaves its page. Leaving is outside React,
 * which an effect follows.
 */
export function useAbortOnUnmount(): () => AbortSignal {
  const controllerRef = useRef<AbortController | null>(null)
  useEffect(() => () => controllerRef.current?.abort(), [])
  return () => {
    controllerRef.current = new AbortController()
    return controllerRef.current.signal
  }
}
