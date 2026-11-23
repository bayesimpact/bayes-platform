import { cn } from "cn"
import type { ReactNode } from "react"

export type PageContainerProps = {
  /** A page that is read, such as a transcript, sits in a narrower column. */
  isNarrow?: boolean
  /**
   * A page whose table has as many columns as its data, such as the records of a dataset, takes
   * all the width there is.
   */
  isWide?: boolean
  children: ReactNode
}

/**
 * The column every page of the app sits in: centered, or as wide as the window for a page with
 * a wide table, with the same margins and gaps. Its top
 * margin is the height of the fade under the bar above the page, so nothing sits under that fade
 * before the page scrolls.
 */
export function PageContainer({ isNarrow = false, isWide = false, children }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6 px-4 pt-6 pb-10 md:px-8",
        isWide ? "max-w-none" : isNarrow ? "max-w-3xl" : "max-w-5xl",
      )}
    >
      {children}
    </div>
  )
}
