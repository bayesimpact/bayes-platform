import type { AgentTypeDto } from "@caseai-connect/desk-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { ArrowRightIcon } from "lucide-react"
import { CommandSearchInput } from "@/components/shared/CommandSearchInput"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import type { DeskAgent, DeskProjectAgents } from "../desk-agents"
import { AgentTypeIcon } from "./AgentTypeIcon"

export type AgentCommandCenterProps = {
  groups: DeskProjectAgents[]
  /** The agent whose pages show, which the list marks. */
  currentAgentId: string
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSelect: (agent: DeskAgent) => void
}

/**
 * Whether an agent's names hold every word of the search, in any order: "billing reader" finds
 * the Invoice Reader of the Billing project. A fuzzy match would also find names that only hold
 * the letters, which reads as noise in a list of names.
 */
function matchesEveryWord(names: string[], search: string): number {
  const text = names.join(" ").toLocaleLowerCase()
  const words = search.toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return words.every((word) => text.includes(word)) ? 1 : 0
}

/** One section per type of agent, in this order, each named once rather than on every line. */
const AGENT_TYPE_SECTIONS = {
  conversation: msg`Conversation agents`,
  extraction: msg`Extraction agents`,
} satisfies Record<AgentTypeDto, MessageDescriptor>

const AGENT_TYPES = ["conversation", "extraction"] as const satisfies readonly AgentTypeDto[]

/**
 * The command center that switches agent: every agent of the person, by project, then within
 * a project by type, conversation agents first, in a wide
 * dialog near the top of the window, with a search on the names of the agents, projects and
 * organizations. The arrows move in the list and Enter opens the agent.
 */
export function AgentCommandCenter({
  groups,
  currentAgentId,
  isOpen,
  onOpenChange,
  onSelect,
}: AgentCommandCenterProps) {
  const { t, i18n } = useLingui()
  const hasSeveralProjects = groups.length > 1
  const hasSeveralOrganizations =
    new Set(groups.map((group) => group.project.organization.id)).size > 1
  // One section per project and type: a search that leaves no agent of a type in a project hides
  // that section alone, and the project's name stays on the other one.
  const sections = groups.flatMap(({ project, agents }) =>
    AGENT_TYPES.flatMap((type) => {
      const agentsOfType = agents.filter((agent) => agent.type === type)
      if (agentsOfType.length === 0) return []
      const place = hasSeveralOrganizations
        ? `${project.name} · ${project.organization.name}`
        : project.name
      return [{ key: `${project.id}-${type}`, place, type, agents: agentsOfType }]
    }),
  )

  return (
    // The dialog of shadcn's `CommandDialog`, with its title inside: the generated one keeps its
    // hidden title in the page while it is closed, a heading no page should carry.
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-16 translate-y-0 gap-0 overflow-hidden rounded-xl! p-0 sm:top-24 sm:max-w-3xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            <Trans>Switch agent</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Search an agent by its name, its project or its organization.</Trans>
          </DialogDescription>
        </DialogHeader>
        <Command
          className="rounded-none! p-0"
          // An item's value is the agent's id, which a search must not match: only its names do.
          filter={(_agentId, search, names = []) => matchesEveryWord(names, search)}
        >
          <CommandSearchInput
            placeholder={t`Search an agent or a project…`}
            end={<Kbd className="hidden sm:inline-flex">Esc</Kbd>}
          />
          <CommandList className="max-h-96 p-2">
            <CommandEmpty>
              <Trans>No agent matches this search.</Trans>
            </CommandEmpty>
            {sections.map((section) => (
              <CommandGroup
                key={section.key}
                heading={
                  hasSeveralProjects ? (
                    <>
                      <span className="text-foreground">{section.place}</span>
                      {" · "}
                      {i18n._(AGENT_TYPE_SECTIONS[section.type])}
                    </>
                  ) : (
                    i18n._(AGENT_TYPE_SECTIONS[section.type])
                  )
                }
                className="**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-3"
              >
                {section.agents.map((agent) => (
                  <AgentCommandItem
                    key={agent.id}
                    agent={agent}
                    keywords={[agent.name, agent.project.name, agent.project.organization.name]}
                    isCurrent={agent.id === currentAgentId}
                    onSelect={() => onSelect(agent)}
                  />
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          {/* The keys of the list, for who has a keyboard: a phone shows none. */}
          <div className="hidden flex-wrap items-center gap-x-5 gap-y-1 border-t bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <Trans comment="What the arrow keys do in the list that switches agent">
                to move
              </Trans>
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              <Trans comment="What the Enter key does in the list that switches agent">
                to open
              </Trans>
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

type AgentCommandItemProps = {
  agent: DeskAgent
  /** The names a search matches: the agent's, and where it is. */
  keywords: string[]
  /** Whether the agent's pages show: it takes the color of the sidebar's active link. */
  isCurrent: boolean
  onSelect: () => void
}

/** An agent of the list, with the icon of its type and, for the current one, its mark. */
function AgentCommandItem({ agent, keywords, isCurrent, onSelect }: AgentCommandItemProps) {
  return (
    <CommandItem
      value={agent.id}
      keywords={keywords}
      onSelect={onSelect}
      className={cn(
        "gap-3 px-3 py-2.5",
        isCurrent &&
          "text-primary *:[svg]:text-primary data-selected:text-primary data-selected:*:[svg]:text-primary",
      )}
    >
      <AgentTypeIcon type={agent.type} />
      <span className="min-w-0 truncate font-medium">{agent.name}</span>
      <CommandShortcut className="flex items-center gap-2 tracking-normal">
        {isCurrent ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
            <Trans comment="Marks the agent whose pages show, in the list that switches agent">
              Current
            </Trans>
          </span>
        ) : null}
        <ArrowRightIcon
          aria-hidden
          className="opacity-0 group-data-selected/command-item:opacity-100"
        />
      </CommandShortcut>
    </CommandItem>
  )
}
