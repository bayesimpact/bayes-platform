import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

export type CommandSearchInputProps = ComponentProps<typeof CommandPrimitive.Input> & {
  /** What sits at the end of the row, such as the key that closes the dialog. */
  end?: ReactNode
}

/**
 * The search of a command center in a dialog: one large row across its top, with no frame of its
 * own, as the dialog frames it. The `CommandInput` of shadcn keeps a small boxed field, made for
 * a command list inside a page.
 */
export function CommandSearchInput({ end, ...props }: CommandSearchInputProps) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <SearchIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className="h-full min-w-0 flex-1 bg-transparent text-base outline-hidden placeholder:text-muted-foreground"
        {...props}
      />
      {end}
    </div>
  )
}
