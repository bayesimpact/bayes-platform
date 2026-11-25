import { Badge, type BadgeVariant } from "@caseai-connect/ui/shad/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@caseai-connect/ui/shad/command"
import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import { cn } from "@caseai-connect/ui/utils"
import { BrainIcon, CheckIcon, ChevronDownIcon, ZapIcon } from "lucide-react"
import { useState } from "react"
import { filterAgentModelOptions } from "./agent-model-select.helpers"

/** What the badges of a model say, in the order they are shown. */
export type AgentModelTag = "recommended" | "outsideEu" | "selfHosted" | "priority" | "reasoning"

export type AgentModelOption = {
  value: string
  /** The readable name, e.g. "Gemini 3.5 Flash". */
  name: string
  /** The technical id, shown small under the name. */
  modelId: string
  /** The heading it is listed under: its vendor, or the workspace for an added model. */
  group: string
  tags: AgentModelTag[]
  /**
   * Set when the model retires: the date, already formatted, the model to move to, and whether
   * the date is past.
   */
  retirement?: { date: string; replacement: string; past: boolean }
  disabled?: boolean
}

export type AgentModelSelectLabels = {
  placeholder: string
  /** The placeholder of the search field at the top of the list. */
  searchPlaceholder: string
  /** Shown when no model matches the search. */
  noResults: string
  tags: Record<AgentModelTag, string>
  /** The badge of a retiring or retired model, e.g. "Retires on Sep 30". */
  retires: (date: string, past: boolean) => string
}

const TAG_VARIANT: Record<AgentModelTag, BadgeVariant> = {
  recommended: "success",
  outsideEu: "warning",
  selfHosted: "secondary",
  priority: "outline",
  reasoning: "outline",
}

/**
 * The model of an agent, grouped by vendor, then the models the workspace added on servers of its
 * own. A search field at the top filters the list on the name, the technical id and the group.
 * Each line shows the readable name, the technical id, and what matters to pick it: the
 * recommended one, where it is served, its retirement. A server URL is never shown here: only the
 * backoffice reads it.
 */
export function AgentModelSelect({
  value,
  onChange,
  options,
  labels,
  defaultOpen,
}: {
  value: string
  onChange: (value: string) => void
  /** In display order: a group starts where its first option is. */
  options: AgentModelOption[]
  labels: AgentModelSelectLabels
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [search, setSearch] = useState("")
  const groups = groupOptions(filterAgentModelOptions(options, search))
  const selected = options.find((option) => option.value === value)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setSearch("")
  }

  const handleSelect = (nextValue: string) => {
    if (nextValue !== value) onChange(nextValue)
    handleOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2.5 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]",
            !selected && "text-muted-foreground",
          )}
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2 text-left">
              <GroupMark group={selected.group} />
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{selected.name}</span>
                <span className="truncate text-xs text-muted-foreground">{selected.modelId}</span>
              </span>
              {selected.tags.includes("priority") && <PriorityBadge labels={labels} />}
            </span>
          ) : (
            <span>{labels.placeholder}</span>
          )}
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-[28rem] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={labels.searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[24rem]">
            <CommandEmpty>{labels.noResults}</CommandEmpty>
            {groups.map((group, groupIndex) => (
              <div key={group.name}>
                {groupIndex > 0 && <CommandSeparator />}
                <CommandGroup
                  heading={
                    <span className="flex items-center gap-2">
                      <GroupMark group={group.name} />
                      {group.name}
                    </span>
                  }
                >
                  {group.options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      onSelect={() => handleSelect(option.value)}
                      className="py-2"
                    >
                      <ModelLine option={option} labels={labels} />
                      <CheckIcon
                        className={cn(
                          "size-4 shrink-0",
                          option.value === value ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ModelLine({
  option,
  labels,
}: {
  option: AgentModelOption
  labels: AgentModelSelectLabels
}) {
  return (
    <span className="flex w-full items-center justify-between gap-4">
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{option.name}</span>
        <span className="truncate text-xs text-muted-foreground">{option.modelId}</span>
      </span>
      <span className="flex shrink-0 flex-wrap justify-end gap-1">
        {option.retirement && (
          <Badge variant="warning" title={`→ ${option.retirement.replacement}`}>
            {labels.retires(option.retirement.date, option.retirement.past)}
          </Badge>
        )}
        {option.tags.map((tag) =>
          tag === "priority" ? (
            <PriorityBadge key={tag} labels={labels} />
          ) : (
            <Badge key={tag} variant={TAG_VARIANT[tag]} className="gap-1">
              {tag === "reasoning" && <BrainIcon className="size-3" />}
              {labels.tags[tag]}
            </Badge>
          ),
        )}
      </span>
    </span>
  )
}

/** Shown only on the model the agent calls with the priority tier, when its switch is on. */
function PriorityBadge({ labels }: { labels: AgentModelSelectLabels }) {
  return (
    <Badge variant={TAG_VARIANT.priority} className="gap-1">
      <ZapIcon className="size-3" />
      {labels.tags.priority}
    </Badge>
  )
}

/** A neutral mark with the first letter of the group, so the groups read at a glance. */
function GroupMark({ group }: { group: string }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
      {group.charAt(0).toUpperCase()}
    </span>
  )
}

function groupOptions(options: AgentModelOption[]) {
  const groups: { name: string; options: AgentModelOption[] }[] = []
  for (const option of options) {
    const group = groups.find((existing) => existing.name === option.group)
    if (group) group.options.push(option)
    else groups.push({ name: option.group, options: [option] })
  }
  return groups
}
