import type { EmbedDisplayMode } from "@caseai-connect/api-contracts"
import type * as React from "react"
import { themeVars } from "../../theme"
import { cn } from "../lib/cn"

export function Chat({
  className,
  children,
  primaryColor,
  displayMode = "modal",
  style,
  ...props
}: React.ComponentProps<"div"> & { primaryColor?: string; displayMode?: EmbedDisplayMode }) {
  return (
    <div
      data-slot="chat"
      className={cn(
        "relative flex h-full flex-col overflow-hidden bg-white",
        // The launcher clips the window to its own corners, and on a phone it fills the screen.
        displayMode === "modal" && "rounded-2xl pointer-coarse:rounded-none",
        className,
      )}
      style={
        {
          ...themeVars(primaryColor),
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </div>
  )
}
