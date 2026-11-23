import type { ReactNode } from "react"
import { FileKindIcon } from "./FileKindIcon"

export type CsvFileHeaderProps = {
  fileName: string
  /** What the page says about the file, under its name. */
  children?: ReactNode
}

/** The heading of a CSV file's setup page: the file's name, and a line about it. */
export function CsvFileHeader({ fileName, children }: CsvFileHeaderProps) {
  return (
    <header className="flex min-w-0 items-center gap-3">
      <FileKindIcon kind="csv" variant="tile" />
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-xl font-semibold tracking-tight">{fileName}</h1>
        {children ? <p className="text-sm text-muted-foreground">{children}</p> : null}
      </div>
    </header>
  )
}
