import { useNavigate } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { McpServersList } from "@/studio/features/mcp-servers/components/McpServersList"
import { selectMcpServersData } from "@/studio/features/mcp-servers/mcp-servers.selectors"
import { createMcpServer, deleteMcpServer } from "@/studio/features/mcp-servers/mcp-servers.thunks"
import { StudioRoutes } from "./helpers"

export function McpServersRoute() {
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
