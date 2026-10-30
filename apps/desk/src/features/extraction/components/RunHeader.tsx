import type { ReactNode } from "react"
import { RelativeTime } from "@/components/shared/RelativeTime"
import type { FileKind } from "../extraction-files"
import { FileKindIcon } from "./FileKindIcon"

export type RunHeaderProps = {
  fileKind: FileKind
  title: string
  /** Where the run stands, as its badge says. */
  status: ReactNode
  createdAt: number
  /** How long the run took, once it ended. */
  duration?: ReactNode
  now: number
}

/** The heading of an extraction's page: its file, where it stands, when it ran and how long. */
export function RunHeader({ fileKind, title, status, createdAt, duration, now }: RunHeaderProps) {
  return (
    <header className="flex min-w-0 items-center gap-3">
      <FileKindIcon kind={fileKind} variant="tile" />
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-xl font-semibold tracking-tight" title={title}>
          {title}
        </h1>
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
          {status}
          <span aria-hidden>·</span>
          <RelativeTime moment={createdAt} now={now} />
          {duration ? (
            <>
              <span aria-hidden>·</span>
              <span>{duration}</span>
            </>
          ) : null}
        </p>
      </div>
    </header>
  )
}
