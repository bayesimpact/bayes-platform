import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { BrainIcon, Trash2Icon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useForgetAllMemories, useForgetMemory } from "../api/mutations"
import { memoriesQueryOptions } from "../api/queries"
import type { MemoryAgent } from "../memory-agent"

export type MemoryPanelProps = {
  agent: MemoryAgent
}

/**
 * What the agent remembers about the person, in a side panel: each fact can be forgotten, or all
 * of them at once. Hidden when the agent remembers nothing, or the person cannot read its memory.
 */
export function MemoryPanel({ agent }: MemoryPanelProps) {
  const { t } = useLingui()
  // useQuery: optional data, shown as a button once known; a 403 hides it without an error page.
  const { data: memories = [] } = useQuery(memoriesQueryOptions(agent))
  const [isConfirming, setIsConfirming] = useState(false)
  const forgetMemory = useForgetMemory(agent)
  const forgetAll = useForgetAllMemories(agent)
  if (memories.length === 0) return null

  const count = memories.length
  const handleForgetAll = () =>
    forgetAll.mutate(undefined, {
      onSuccess: () => {
        setIsConfirming(false)
        toast.success(t`The agent forgot everything about you.`)
      },
      onError: () => toast.error(t`The memory could not be cleared. Try again.`),
    })

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <BrainIcon aria-hidden />
        <Plural value={count} one="Memory (#)" other="Memory (#)" />
      </SheetTrigger>
      <SheetContent showCloseButton={false} className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-start justify-between gap-2">
            <SheetTitle>
              <Trans>What the agent remembers</Trans>
            </SheetTitle>
            <SheetClose render={<Button variant="ghost" size="icon-sm" aria-label={t`Close`} />}>
              <XIcon aria-hidden />
            </SheetClose>
          </div>
          <SheetDescription>
            <Trans>The agent uses these facts in your next conversations. Only you see them.</Trans>
          </SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-2 px-4">
          {memories.map((memory) => {
            const content = memory.content
            return (
              <li key={memory.id} className="flex items-start gap-2 rounded-lg border p-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p>{content}</p>
                  {memory.status === "pending" ? (
                    <Badge variant="secondary" className="w-fit">
                      <Trans>Waiting for your answer</Trans>
                    </Badge>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t`Forget "${content}"`}
                  disabled={forgetMemory.isPending}
                  onClick={() =>
                    forgetMemory.mutate(memory.id, {
                      onError: () => toast.error(t`The fact could not be forgotten. Try again.`),
                    })
                  }
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
        <SheetFooter>
          <Button variant="outline" onClick={() => setIsConfirming(true)}>
            <Trans>Forget everything</Trans>
          </Button>
        </SheetFooter>
        <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <Trans>Forget everything?</Trans>
              </AlertDialogTitle>
              <AlertDialogDescription>
                <Trans>The agent will forget every fact it remembers about you.</Trans>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Trans>Cancel</Trans>
              </AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={forgetAll.isPending}
                onClick={handleForgetAll}
              >
                <Trans>Forget everything</Trans>
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
