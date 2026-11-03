import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@caseai-connect/ui/shad/input-group"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@caseai-connect/ui/shad/item"
import { SearchIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { InviteAgent } from "./invite-members.models"

/** Above this many agents, a search box narrows the list. */
const SEARCH_THRESHOLD = 6

/** The agents to give access to, one tick each. Every agent picked gives its member role. */
export function InviteAgentsField({
  agents,
  value,
  onChange,
}: {
  agents: InviteAgent[]
  value: string[]
  onChange: (agentIds: string[]) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const picked = new Set(value)
  const query = search.trim().toLowerCase()
  const visibleAgents = query
    ? agents.filter((agent) => agent.name.toLowerCase().includes(query))
    : agents

  const toggle = (agentId: string, checked: boolean) =>
    onChange(checked ? [...value, agentId] : value.filter((pickedId) => pickedId !== agentId))

  return (
    <div className="flex flex-col gap-2">
      {agents.length > SEARCH_THRESHOLD && (
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder={t("actions:search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
      )}
      <ItemGroup className="gap-1">
        {visibleAgents.map((agent) => {
          const id = `invite-agent-${agent.id}`
          const isPicked = picked.has(agent.id)
          return (
            <Item key={agent.id} variant={isPicked ? "muted" : "default"} size="sm" asChild>
              <label htmlFor={id} className="cursor-pointer py-2">
                <Checkbox
                  id={id}
                  checked={isPicked}
                  onCheckedChange={(checked) => toggle(agent.id, checked === true)}
                />
                {/* One line per agent: its name, then its type. */}
                <ItemContent className="flex-row items-baseline gap-2">
                  <ItemTitle>{agent.name}</ItemTitle>
                  {agent.detail && (
                    <ItemDescription className="text-xs">{agent.detail}</ItemDescription>
                  )}
                </ItemContent>
              </label>
            </Item>
          )
        })}
        {visibleAgents.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {t("invitations:inviteDialog.noMatch")}
          </p>
        )}
      </ItemGroup>
    </div>
  )
}
