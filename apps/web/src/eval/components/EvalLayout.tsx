import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from "react"
import { HorizontalNavbar } from "@/common/components/sidebar/nav/HorizontalNavbar"
import { selectMe } from "@/common/features/me/me.selectors"
import { useValue } from "@/common/hooks/use-value"

// Container width variants. List/detail pages use "default"; pages with wide content
// (run reports, run comparison) opt into "wide" via `useEvalLayoutWidth`.
export type EvalLayoutWidth = "default" | "wide"

const WIDTH_CLASS_NAMES: Record<EvalLayoutWidth, string> = {
  default: "w-4/5 lg:w-3/4 my-10 border rounded-2xl overflow-hidden",
  wide: "w-4/5 lg:w-full",
}

type EvalLayoutContextValue = {
  requestWidth: (id: string, width: EvalLayoutWidth) => void
  releaseWidth: (id: string) => void
}

const EvalLayoutContext = createContext<EvalLayoutContextValue | null>(null)

export function useEvalLayout(): EvalLayoutContextValue {
  const context = useContext(EvalLayoutContext)
  if (!context) throw new Error("useEvalLayout must be used within an EvalLayout")
  return context
}

/**
 * Applies a layout width while the calling page is mounted, restoring the previous
 * width when it unmounts. Order-independent: the request is keyed by the page, so a
 * freshly-mounted page still wins even if the unmounting page's cleanup runs after.
 */
export function useEvalLayoutWidth(width: EvalLayoutWidth): void {
  const { requestWidth, releaseWidth } = useEvalLayout()
  const id = useId()
  useEffect(() => {
    requestWidth(id, width)
    return () => releaseWidth(id)
  }, [id, width, requestWidth, releaseWidth])
}

export function EvalLayout({ children }: { children: React.ReactNode }) {
  const user = useValue(selectMe)
  // Active width requests keyed by page id; the most recent one wins.
  const [requests, setRequests] = useState<{ id: string; width: EvalLayoutWidth }[]>([])

  const requestWidth = useCallback((id: string, width: EvalLayoutWidth) => {
    setRequests((current) => [...current.filter((request) => request.id !== id), { id, width }])
  }, [])
  const releaseWidth = useCallback((id: string) => {
    setRequests((current) => current.filter((request) => request.id !== id))
  }, [])

  const contextValue = useMemo<EvalLayoutContextValue>(
    () => ({ requestWidth, releaseWidth }),
    [requestWidth, releaseWidth],
  )

  const width = requests.at(-1)?.width ?? "default"

  return (
    <EvalLayoutContext.Provider value={contextValue}>
      <HorizontalNavbar user={user} appName="Evaluation" />
      <div className={`${WIDTH_CLASS_NAMES[width]} mx-auto relative`}>{children}</div>
    </EvalLayoutContext.Provider>
  )
}
