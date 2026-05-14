import { BreadcrumbItem, BreadcrumbLink } from "@caseai-connect/ui/shad/breadcrumb"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import { cn } from "@caseai-connect/ui/utils"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { Link } from "react-router-dom"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectAgentsData, selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { useBuildPath } from "@/common/hooks/use-build-path"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"

export function BreadcrumbAgent({ organizationId }: { organizationId: string }) {
  const agents = useAppSelector(selectAgentsData)
  const agent = useAppSelector(selectCurrentAgentData)
  const { buildPath } = useBuildPath()
  if (!ADS.isFulfilled(agents) || !ADS.isFulfilled(agent)) return null

  const handleClick = (agentId: string) => () => {
    const nextAgent = agents.value.find((candidateAgent) => candidateAgent.id === agentId)
    if (!nextAgent) return
    const path = buildPath("agent", { organizationId, projectId: agent.value.projectId, agentId })
    window.location.assign(path)
  }

  if (agents.value.length === 1)
    return <CurrentAgentButton agent={agent.value} organizationId={organizationId} />
  return (
    <div className="flex items-center">
      <CurrentAgentButton agent={agent.value} organizationId={organizationId} />
      <BreadcrumbItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <ChevronDownIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              {agents.value.map((a) => (
                <AgentItem
                  key={a.id}
                  agent={a}
                  isActive={a.id === agent.value.id}
                  onClick={handleClick(a.id)}
                />
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </BreadcrumbItem>
    </div>
  )
}

function CurrentAgentButton({ agent, organizationId }: { agent: Agent; organizationId: string }) {
  const { buildPath } = useBuildPath()
  const currentAgentPath = buildPath("agent", {
    organizationId,
    projectId: agent.projectId,
    agentId: agent.id,
  })

  const Icon = getAgentIcon(agent.type)
  return (
    <BreadcrumbItem>
      <BreadcrumbLink asChild>
        <Button variant="ghost" size="sm" asChild>
          <Link to={currentAgentPath} className="flex items-center gap-1">
            <Icon className="size-4" /> {agent.name}
          </Link>
        </Button>
      </BreadcrumbLink>
    </BreadcrumbItem>
  )
}

function AgentItem({
  agent,
  onClick,
  isActive,
}: {
  agent: Agent
  onClick: () => void
  isActive: boolean
}) {
  const Icon = getAgentIcon(agent.type)

  return (
    <DropdownMenuItem
      key={agent.id}
      className={cn("justify-between", isActive && "font-semibold")}
      onClick={onClick}
    >
      <div className="flex gap-2">
        <Icon className="size-4" /> {agent.name}
      </div>
      {isActive && <CheckIcon className="size-4 text-inherit" />}
    </DropdownMenuItem>
  )
}
