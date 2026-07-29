import { type AgentSettingsDto, AgentSettingsRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { AgentSettings } from "../agent-settings.models"
import type { IAgentSettingsSpi } from "../agent-settings.spi"

export default {
  getAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentSettingsRoutes.getAll.response>(
      AgentSettingsRoutes.getAll.getPath(params),
    )
    return response.data.data.map(toAgentSettings)
  },
  updateOne: async (params, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.patch<typeof AgentSettingsRoutes.updateOne.response>(
      AgentSettingsRoutes.updateOne.getPath(params),
      { payload } satisfies typeof AgentSettingsRoutes.updateOne.request,
    )
    return toAgentSettings(response.data.data)
  },
  publishOne: async ({ revision, ...params }, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentSettingsRoutes.publishOne.response>(
      AgentSettingsRoutes.publishOne.getPath({ ...params, revision: String(revision) }),
      { payload } satisfies typeof AgentSettingsRoutes.publishOne.request,
    )
    return toAgentSettings(response.data.data)
  },
  archiveOne: async ({ revision, ...params }) => {
    const axios = getAxiosInstance()
    await axios.post(
      AgentSettingsRoutes.archiveOne.getPath({ ...params, revision: String(revision) }),
    )
  },
  restoreOne: async ({ revision, ...params }) => {
    const axios = getAxiosInstance()
    await axios.post(
      AgentSettingsRoutes.restoreOne.getPath({ ...params, revision: String(revision) }),
    )
  },
} satisfies IAgentSettingsSpi

const toAgentSettings = (dto: AgentSettingsDto): AgentSettings => ({ ...dto })
