import { cn } from "cn"
import {
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  type LucideIcon,
} from "lucide-react"
import type { FileKind } from "../extraction-files"

const ICONS: Record<FileKind, LucideIcon> = {
  pdf: FileTextIcon,
  image: FileImageIcon,
  text: FileTextIcon,
  csv: FileSpreadsheetIcon,
  other: FileIcon,
}

export type FileKindIconProps = {
  kind: FileKind
  /** `tile` frames the icon, as a page's heading shows it. */
  variant?: "plain" | "tile"
  className?: string
}

/** The icon of a file, by its kind. */
export function FileKindIcon({ kind, variant = "plain", className }: FileKindIconProps) {
  const Icon = ICONS[kind]
  if (variant === "plain") return <Icon aria-hidden className={cn("size-4 shrink-0", className)} />
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-5" />
    </span>
  )
}
