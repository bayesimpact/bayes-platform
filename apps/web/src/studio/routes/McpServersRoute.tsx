import { useNavigate } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { McpServersList } from "@/studio/features/mcp-servers/components/McpServersList"
import { selectMcpServersData } from "@/studio/features/mcp-servers/mcp-servers.selectors"
import { createMcpServer, deleteMcpServer } from "@/studio/features/mcp-servers/mcp-servers.thunks"
import { StudioRoutes } from "./helpers"

// `mcpServers` loads via a listener on `projectsActions.mount`, which `OrganizationRoute` (an
// ancestor of every project route, including this one) dispatches once the organization is
// fulfilled, regardless of which child path is entered. So the load already fires when this
// route is entered directly; no dedicated `useMount` is needed here, only the gate below to
// cover the render that can otherwise happen before that load resolves.
export function McpServersRoute() {
  const mcpServers = useAppSelector(selectMcpServersData)
  return (
    <AsyncRoute data={[mcpServers]}>
      <McpServersRouteContent />
    </AsyncRoute>
  )
}

function McpServersRouteContent() {
  const mcpServers = useValue(selectMcpServersData)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)

  const handleBack = () => {
    navigate(StudioRoutes.project.build({ organizationId, projectId }))
  }

  const handleCreate = (fields: { name: string; url: string; apiKey?: string }) => {
    dispatch(createMcpServer({ fields, onSuccess: () => {} }))
  }

  const handleDelete = (mcpServerId: string) => {
    dispatch(deleteMcpServer({ mcpServerId, onSuccess: () => {} }))
  }

  return (
    <McpServersList
      mcpServers={mcpServers}
      onCreate={handleCreate}
      onDelete={handleDelete}
      onBack={handleBack}
    />
  )
}
