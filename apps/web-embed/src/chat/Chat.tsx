import type * as React from "react"
import { cn } from "./lib/cn"
import { DEFAULT_PRIMARY_COLOR } from "../theme"

export function Chat({
  className,
  children,
  primaryColor,
  style,
  ...props
}: React.ComponentProps<"div"> & { primaryColor?: string }) {
  return (
    <div
      data-slot="chat"
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl bg-white",
        className,
      )}
      style={
        {
          "--embed-primary": primaryColor ?? DEFAULT_PRIMARY_COLOR,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </div>
  )
}
