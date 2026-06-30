import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getApiErrorMessage } from "@/common/utils/api-error"
import type { McpServer } from "./mcp-servers.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg; rejectValue: string }

const currentProjectScope = (state: RootState) => ({
  organizationId: getCurrentId({ state, name: "organizationId" }),
  projectId: getCurrentId({ state, name: "projectId" }),
})

export const listMcpServers = createAsyncThunk<McpServer[], void, ThunkConfig>(
  "mcpServers/list",
  async (_, { extra: { services }, getState }) => {
    return await services.mcpServers.getAll(currentProjectScope(getState()))
  },
)

export const createMcpServer = createAsyncThunk<
  McpServer,
  { fields: { name: string; url: string; apiKey?: string }; onSuccess: () => void },
  ThunkConfig
>("mcpServers/create", async ({ fields }, { extra: { services }, getState, rejectWithValue }) => {
  try {
    return await services.mcpServers.createOne(currentProjectScope(getState()), fields)
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, ""))
  }
})

export const deleteMcpServer = createAsyncThunk<
  void,
  { mcpServerId: string; onSuccess: () => void },
  ThunkConfig
>(
  "mcpServers/delete",
  async ({ mcpServerId }, { extra: { services }, getState, rejectWithValue }) => {
    try {
      await services.mcpServers.deleteOne({ ...currentProjectScope(getState()), mcpServerId })
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, ""))
    }
  },
)

export const enableMcpServerForAgent = createAsyncThunk<
  void,
  { mcpServerId: string; agentId: string },
  ThunkConfig
>(
  "mcpServers/enableForAgent",
  async ({ mcpServerId, agentId }, { extra: { services }, getState, rejectWithValue }) => {
    try {
      await services.mcpServers.enableForAgent({
        ...currentProjectScope(getState()),
        mcpServerId,
        agentId,
      })
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, ""))
    }
  },
)

export const disableMcpServerForAgent = createAsyncThunk<
  void,
  { mcpServerId: string; agentId: string },
  ThunkConfig
>(
  "mcpServers/disableForAgent",
  async ({ mcpServerId, agentId }, { extra: { services }, getState, rejectWithValue }) => {
    try {
      await services.mcpServers.disableForAgent({
        ...currentProjectScope(getState()),
        mcpServerId,
        agentId,
      })
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, ""))
    }
  },
)
