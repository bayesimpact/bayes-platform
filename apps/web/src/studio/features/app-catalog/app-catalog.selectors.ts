import type { RootState } from "@/common/store"

export const selectAppCatalogData = (state: RootState) => state.appCatalog.data
