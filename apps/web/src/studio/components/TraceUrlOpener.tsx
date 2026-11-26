import { Button } from "@bayes-platform/ui/shad/button"
import { ExternalLinkIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { selectCanViewTraces } from "@/common/features/me/me.selectors"
import { useAppSelector } from "@/common/store/hooks"

export function TraceUrlOpener({
  traceUrl,
  buttonProps,
}: {
  traceUrl?: string
  buttonProps?: React.ComponentProps<typeof Button>
}) {
  const canViewTraces = useAppSelector(selectCanViewTraces)
  const [isShown, setIsShown] = useState(false)

  useEffect(() => {
    if (!canViewTraces) return

    function keyDownHandler(e: globalThis.KeyboardEvent) {
      if (traceUrl && e.key === "Control") {
        e.preventDefault()
        setIsShown((state) => !state)
      }
    }
    // Remove any existing listener before adding a new one
    document.removeEventListener("keydown", keyDownHandler)
    document.addEventListener("keydown", keyDownHandler)
    return () => document.removeEventListener("keydown", keyDownHandler)
  }, [traceUrl, canViewTraces])

  if (!traceUrl || !canViewTraces || !isShown) return null
  return (
    <Button asChild variant="ghost" {...buttonProps}>
      <a href={traceUrl} className="cursor-pointer" target="_blank" rel="noreferrer">
        Trace Url
        <ExternalLinkIcon className="size-4" />
      </a>
    </Button>
  )
}
