import type { RootState } from "@/common/store"

export const selectConversationDatasetsData = (state: RootState) => state.conversationDatasets.data
