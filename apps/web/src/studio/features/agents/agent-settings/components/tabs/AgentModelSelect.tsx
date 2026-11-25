import { Badge, type BadgeVariant } from "@caseai-connect/ui/shad/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { BrainIcon, ZapIcon } from "lucide-react"

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
 * own. Each line shows the readable name, the technical id, and what matters to pick it: the
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
  const groups = groupOptions(options)
  const selected = options.find((option) => option.value === value)

  return (
    <Select value={value} onValueChange={onChange} defaultOpen={defaultOpen}>
      <SelectTrigger className="w-full py-2.5 data-[size=default]:h-auto">
        <SelectValue placeholder={labels.placeholder}>
          {selected && (
            <span className="flex items-center gap-2 text-left">
              <GroupMark group={selected.group} />
              <span className="flex flex-col">
                <span className="font-medium">{selected.name}</span>
                <span className="text-xs text-muted-foreground">{selected.modelId}</span>
              </span>
              {selected.tags.includes("priority") && <PriorityBadge labels={labels} />}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[28rem] min-w-[28rem]">
        {groups.map((group, groupIndex) => (
          <SelectGroup key={group.name}>
            {groupIndex > 0 && <SelectSeparator />}
            <SelectLabel className="flex items-center gap-2">
              <GroupMark group={group.name} />
              {group.name}
            </SelectLabel>
            {group.options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="py-2 *:[span]:last:w-full"
              >
                <ModelLine option={option} labels={labels} />
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
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
