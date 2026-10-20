import { cn } from "@caseai-connect/ui/utils"
import { type ReactNode, useEffect, useRef, useState } from "react"

const FADE = "2.5rem"

/**
 * A scroll container whose edges fade while there is more to scroll that way, so a cut-off
 * list reads as one. A mask, not an overlay, so it works over rows with their own background.
 */
export function ScrollFade({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ top: false, bottom: false })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () =>
      setEdges({
        top: element.scrollTop > 1,
        bottom: element.scrollTop + element.clientHeight < element.scrollHeight - 1,
      })
    update()
    element.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    for (const child of element.children) observer.observe(child)
    return () => {
      element.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [])

  const maskImage = `linear-gradient(to bottom, ${edges.top ? "transparent" : "black"}, black ${FADE}, black calc(100% - ${FADE}), ${edges.bottom ? "transparent" : "black"})`
  return (
    <div
      ref={ref}
      className={cn("overflow-y-auto overscroll-contain [scrollbar-width:thin]", className)}
      style={{ maskImage }}
    >
      {children}
    </div>
  )
}
