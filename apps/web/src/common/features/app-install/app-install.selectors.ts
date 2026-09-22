import type { RootState } from "@/common/store"

export const selectAppInstallPage = (state: RootState) => state.appInstall.page
