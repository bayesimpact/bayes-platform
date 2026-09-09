import { type McpServerDto, McpServersRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { McpServer } from "../mcp-servers.models"
import type { IMcpServersSpi } from "../mcp-servers.spi"

export default {
  getAll: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof McpServersRoutes.getAll.response>(
      McpServersRoutes.getAll.getPath({ organizationId, projectId }),
    )
    return response.data.data.map(toMcpServer)
  },
  createOne: async ({ organizationId, projectId }, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof McpServersRoutes.createOne.response>(
      McpServersRoutes.createOne.getPath({ organizationId, projectId }),
      { payload } satisfies typeof McpServersRoutes.createOne.request,
    )
    return toMcpServer(response.data.data)
  },
  deleteOne: async ({ organizationId, projectId, mcpServerId }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      McpServersRoutes.deleteOne.getPath({ organizationId, projectId, mcpServerId }),
    )
  },
  enableForAgent: async ({ organizationId, projectId, mcpServerId, agentId }) => {
    const axios = getAxiosInstance()
    await axios.post(
      McpServersRoutes.enableForAgent.getPath({ organizationId, projectId, mcpServerId, agentId }),
    )
  },
  disableForAgent: async ({ organizationId, projectId, mcpServerId, agentId }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      McpServersRoutes.disableForAgent.getPath({
        organizationId,
        projectId,
        mcpServerId,
        agentId,
      }),
    )
  },
  initiateOauth: async ({ organizationId, projectId, mcpServerId }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof McpServersRoutes.initiateOauth.response>(
      McpServersRoutes.initiateOauth.getPath({ organizationId, projectId, mcpServerId }),
    )
    return response.data.data
  },
  completeOauth: async ({ organizationId, projectId, mcpServerId }, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof McpServersRoutes.completeOauth.response>(
      McpServersRoutes.completeOauth.getPath({ organizationId, projectId, mcpServerId }),
      { payload } satisfies typeof McpServersRoutes.completeOauth.request,
    )
    return toMcpServer(response.data.data)
  },
} satisfies IMcpServersSpi

const toMcpServer = (dto: McpServerDto): McpServer => ({
  id: dto.id,
  name: dto.name,
  url: dto.url,
  projectId: dto.projectId,
  isBuiltIn: dto.isBuiltIn,
  authStatus: dto.authStatus,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
})
