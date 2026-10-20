import { SidebarMenuButton, SidebarMenuItem } from "@caseai-connect/ui/shad/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { cn } from "@caseai-connect/ui/utils"
import { AlertTriangleIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  agentModelDeprecationStage,
  buildAgentModelDeprecationInterpolation,
} from "@/common/features/agents/agent-model.helpers"
import { selectAgentSettingsDataByAgentId } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import { selectAvailableModelsCatalog } from "@/common/features/agents/agents.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { isStudioInterface } from "@/studio/routes/helpers"
import type { MenuItem } from "../types"

export function AppNavItem({
  item,
  itemOptions,
  children,
}: {
  item: MenuItem
  itemOptions?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={item.isActive} asChild>
        <Link to={item.url}>
          {isStudioInterface() && <DeprecatedModelIcon agentId={item.id} />}
          {item.icon && <item.icon />}
          {/* Truncated on its own: the button only truncates its last child, which itemOptions can be. */}
          <span className={cn("truncate", item.isActive && "font-semibold")}>{item.title}</span>
          {itemOptions}
        </Link>
      </SidebarMenuButton>

      {children}
    </SidebarMenuItem>
  )
}

/**
 * Marks an agent whose model is being retired. The tooltip repeats what `DeprecatedModelBanner`
 * says on the agent page, so the sidebar tells you which agent to open before you open it.
 */
function DeprecatedModelIcon({ agentId }: { agentId: string }) {
  const { t } = useTranslation()
  const agentSettings = useAppSelector(selectAgentSettingsDataByAgentId({ agentId }))
  const catalog = useAppSelector(selectAvailableModelsCatalog)
  const interpolation = buildAgentModelDeprecationInterpolation(agentSettings.value?.model, catalog)
  const stage = agentModelDeprecationStage(agentSettings.value?.model, catalog)

  if (!interpolation) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* The icon is inside the nav Link, so the trigger stays a span: a nested button would
            be invalid HTML and would swallow the navigation click. */}
        <span className="flex items-center">
          <AlertTriangleIcon className="size-4 text-orange-500" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-72">
        <span className="block font-semibold">
          {t(`agent:model.${stage}.title`, interpolation)}
        </span>
        <span className="block">{t(`agent:model.${stage}.description`, interpolation)}</span>
      </TooltipContent>
    </Tooltip>
  )
}
