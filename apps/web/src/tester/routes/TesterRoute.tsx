import { useTranslation } from "react-i18next"
import { HorizontalNavbar } from "@/common/components/sidebar/nav/HorizontalNavbar"
import { selectMe } from "@/common/features/me/me.selectors"
import { useInitStore } from "@/common/hooks/use-init-store"
import { useSetCurrentIds } from "@/common/hooks/use-set-current-ids"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { RouteNames } from "@/common/routes/helpers"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppSelector } from "@/common/store/hooks"
import { currentIdsActions } from "../store/currentIds.slice"
import { injectTesterSlices, resetTesterSlices } from "../store/slices"
import { CampaignsRoute } from "./CampaignsRoute"

export function TesterRoute() {
  const { initDone } = useInitStore({
    inject: injectTesterSlices,
    reset: resetTesterSlices,
    condition: true,
  })

  if (initDone) return <Route />
  return <LoadingRoute />
}

function Route() {
  useSetCurrentIds(currentIdsActions)
  const me = useAppSelector(selectMe)
  return (
    <AsyncRoute data={[me]}>
      <Layout />
    </AsyncRoute>
  )
}

function Layout() {
  const { t } = useTranslation()
  const user = useValue(selectMe)
  return (
    <>
      <HorizontalNavbar
        user={user}
        homePath={RouteNames.HOME}
        appName={t("testerCampaigns:shell.title")}
      />
      <div className="mx-10 xl:mx-20 my-10 relative border rounded-2xl overflow-hidden">
        <CampaignsRoute />
      </div>
    </>
  )
}
