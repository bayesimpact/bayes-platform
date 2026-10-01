import type { RootState } from "@/common/store"

export const selectDocumentSourcesData = (state: RootState) => state.documentSources.data
