import type { RootState } from "@/common/store"

export const selectAppInstallationsData = (state: RootState) => state.appInstallations.data
