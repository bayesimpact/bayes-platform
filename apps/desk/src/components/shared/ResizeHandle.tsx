import { cn } from "cn"
import type { ComponentProps } from "react"

export type ResizeHandleProps = ComponentProps<"div"> & {
  /** The edge of its element the handle sits on. */
  edge: "left" | "right"
}

/**
 * The edge of an element the person drags to resize it: a thin line that shows on hover or focus,
 * with the resize cursor. It takes the props of `useResizableWidth`.
 */
export function ResizeHandle({ edge, className, ...props }: ResizeHandleProps) {
  return (
    <div
      className={cn(
        "group/resize absolute inset-y-0 z-20 flex w-3 cursor-col-resize justify-center outline-none",
        edge === "right" ? "-right-1.5" : "-left-1.5",
        className,
      )}
      {...props}
    >
      <span className="h-full w-px bg-transparent transition-colors group-hover/resize:bg-border group-focus-visible/resize:bg-ring group-active/resize:bg-ring" />
    </div>
  )
}
