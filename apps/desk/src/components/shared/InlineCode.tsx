import { cn } from "cn"
import type { ReactNode } from "react"

/**
 * The classes of the chip, which the message box gives its code marks too. Its border sets it
 * apart on the white of a reply and on the grey of the person's message alike.
 */
export const inlineCodeClassName =
  "rounded-md border border-border bg-muted/60 px-1 py-0.5 font-mono text-code-inline box-decoration-clone"

export type InlineCodeProps = {
  children: ReactNode
  /** Classes that change its look, such as the yellow of a passage quoted from a reply. */
  className?: string
}

/**
 * Code or a quoted passage inside a line of text, in the same chip everywhere: a reply's inline
 * code, the passages a person quotes in their message, and the message box as they write. A chip
 * that wraps keeps its edges on each line.
 */
export function InlineCode({ children, className }: InlineCodeProps) {
  return <code className={cn(inlineCodeClassName, className)}>{children}</code>
}
