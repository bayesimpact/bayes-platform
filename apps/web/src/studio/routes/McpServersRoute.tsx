import { useNavigate } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { McpServersList } from "@/studio/features/mcp-servers/components/McpServersList"
import {
  selectMcpServerConnections,
  selectMcpServersData,
} from "@/studio/features/mcp-servers/mcp-servers.selectors"
import { mcpServersActions } from "@/studio/features/mcp-servers/mcp-servers.slice"
import type {
  CreateMcpServerFields,
  UpdateMcpServerFields,
} from "@/studio/features/mcp-servers/mcp-servers.spi"
import {
  createMcpServer,
  deleteMcpServer,
  initiateMcpServerOauth,
  inspectMcpServer,
  updateMcpServer,
} from "@/studio/features/mcp-servers/mcp-servers.thunks"
import { StudioRoutes } from "./helpers"

export function McpServersRoute() {
  const mcpServers = useAppSelector(selectMcpServersData)
  // The page shows live statuses: its mount lists the servers again and
  // connects to each of them (see the middleware).
  useMount({ actions: { mount: mcpServersActions.mount, unmount: mcpServersActions.unmount } })
  return (
    <AsyncRoute data={[mcpServers]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const mcpServers = useValue(selectMcpServersData)
  const connections = useAppSelector(selectMcpServerConnections)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)

  const handleBack = () => {
    navigate(StudioRoutes.project.build({ organizationId, projectId }))
  }

  const handleCreate = (fields: CreateMcpServerFields) => {
    dispatch(createMcpServer({ fields, onSuccess: () => {} }))
  }

  const handleUpdate = (mcpServerId: string, fields: UpdateMcpServerFields) => {
    dispatch(updateMcpServer({ mcpServerId, fields, onSuccess: () => {} }))
  }

  const handleDelete = (mcpServerId: string) => {
    dispatch(deleteMcpServer({ mcpServerId, onSuccess: () => {} }))
  }

  const handleInspect = (mcpServerId: string) => {
    dispatch(inspectMcpServer({ mcpServerId }))
  }

  const handleAuthorize = (mcpServerId: string) => {
    dispatch(initiateMcpServerOauth({ mcpServerId }))
  }

  return (
    <McpServersList
      mcpServers={mcpServers}
      connections={connections}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onInspect={handleInspect}
      onBack={handleBack}
      onAuthorize={handleAuthorize}
    />
  )
}
