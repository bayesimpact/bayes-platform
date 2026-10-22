import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { BrainIcon, CheckIcon, PencilIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useResolveMemoryProposals } from "../api/mutations"
import { memoriesQueryOptions } from "../api/queries"
import { MemoryRewordForm } from "./MemoryRewordForm"

export type MemoryProposalsProps = {
  agent: AgentParamsDto
  /** The facts this reply saved or proposed to remember. */
  memoryIds: string[]
}

/**
 * The facts a reply remembered or proposes to remember, under the reply. The person saves a
 * proposal, rewords it or turns it down; a fact forgotten since then no longer shows.
 */
export function MemoryProposals({ agent, memoryIds }: MemoryProposalsProps) {
  const { t } = useLingui()
  // useQuery: optional data under a reply, which must not hold the conversation back.
  const { data: memories = [] } = useQuery(memoriesQueryOptions(agent))
  const [rewordingId, setRewordingId] = useState<string | null>(null)
  const resolveProposals = useResolveMemoryProposals(agent)
  const facts = memories.filter((memory) => memoryIds.includes(memory.id))
  if (facts.length === 0) return null

  const decide = (decision: { memoryId: string; decision: "save" | "reject"; content?: string }) =>
    resolveProposals.mutate([decision], {
      onSuccess: () => setRewordingId(null),
      onError: () => toast.error(t`Your answer could not be saved. Try again.`),
    })

  return (
    <ul className="flex flex-col gap-2 text-sm">
      {facts.map((fact) => {
        const content = fact.content
        return (
          <li key={fact.id} className="flex flex-col gap-2 rounded-xl border p-3">
            <div className="flex items-start gap-2">
              <BrainIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  {fact.status === "saved" ? (
                    <Trans>The agent remembers</Trans>
                  ) : (
                    <Trans>Should the agent remember this?</Trans>
                  )}
                </span>
                <span>{content}</span>
              </div>
            </div>
            {fact.status === "pending" && rewordingId === fact.id ? (
              <MemoryRewordForm
                initialContent={content}
                isSaving={resolveProposals.isPending}
                onCancel={() => setRewordingId(null)}
                onSave={(reworded) =>
                  decide({ memoryId: fact.id, decision: "save", content: reworded })
                }
              />
            ) : null}
            {fact.status === "pending" && rewordingId !== fact.id ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={resolveProposals.isPending}
                  onClick={() => decide({ memoryId: fact.id, decision: "save" })}
                >
                  <CheckIcon aria-hidden />
                  <Trans>Remember</Trans>
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRewordingId(fact.id)}>
                  <PencilIcon aria-hidden />
                  <Trans>Reword</Trans>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={resolveProposals.isPending}
                  onClick={() => decide({ memoryId: fact.id, decision: "reject" })}
                >
                  <XIcon aria-hidden />
                  <Trans>Don't remember</Trans>
                </Button>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
