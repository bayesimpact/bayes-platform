import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { SidePanel } from "@/components/shared/SidePanel"
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
import { useForgetAllMemories, useForgetMemory } from "../api/mutations"
import { memoriesQueryOptions } from "../api/queries"

export type MemoryPanelProps = {
  agent: AgentParamsDto
  onClose: () => void
}

/**
 * What the agent remembers about the person, in the side panel: each fact can be forgotten, or
 * all of them at once, after a confirmation.
 */
export function MemoryPanel({ agent, onClose }: MemoryPanelProps) {
  const { t } = useLingui()
  // useQuery: the panel reads what the button already loaded; a 403 shows an empty panel.
  const { data: memories = [] } = useQuery(memoriesQueryOptions(agent))
  const [isConfirming, setIsConfirming] = useState(false)
  const forgetMemory = useForgetMemory(agent)
  const forgetAll = useForgetAllMemories(agent)

  const handleForgetAll = () =>
    forgetAll.mutate(undefined, {
      onSuccess: () => {
        setIsConfirming(false)
        toast.success(t`The agent forgot everything about you.`)
      },
      onError: () => toast.error(t`The memory could not be cleared. Try again.`),
    })

  return (
    <SidePanel
      title={<Trans>What the agent remembers</Trans>}
      description={
        <Trans>The agent uses these facts in your next conversations. Only you see them.</Trans>
      }
      onClose={onClose}
      footer={
        memories.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setIsConfirming(true)}>
            <Trans>Forget everything</Trans>
          </Button>
        ) : null
      }
    >
      {memories.length === 0 ? (
        <p className="text-muted-foreground">
          <Trans>The agent remembers nothing about you.</Trans>
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
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
      )}
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
            <Button variant="destructive" disabled={forgetAll.isPending} onClick={handleForgetAll}>
              <Trans>Forget everything</Trans>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidePanel>
  )
}
