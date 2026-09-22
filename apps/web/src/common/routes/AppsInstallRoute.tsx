import { isLoopbackRedirectUri } from "@caseai-connect/api-contracts"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useParams, useSearchParams } from "react-router-dom"
import { selectAppInstallPage } from "@/common/features/app-install/app-install.selectors"
import { appInstallActions } from "@/common/features/app-install/app-install.slice"
import { fetchInstallPage } from "@/common/features/app-install/app-install.thunks"
import { AppsInstallCard } from "@/common/features/app-install/components/AppsInstallCard"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "./AsyncRoute"
import { ErrorRoute } from "./ErrorRoute"

export function AppsInstallRoute() {
  const { t } = useTranslation("appInstall")
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const dispatch = useAppDispatch()
  const page = useAppSelector(selectAppInstallPage)
  const redirectUri = searchParams.get("redirect_uri") ?? ""
  const state = searchParams.get("state") ?? ""
  const hasValidLoopback = isLoopbackRedirectUri(redirectUri) && state.length > 0

  useEffect(() => {
    if (!slug || !hasValidLoopback) return
    dispatch(fetchInstallPage(slug))
    return () => {
      dispatch(appInstallActions.reset())
    }
  }, [dispatch, slug, hasValidLoopback])

  if (!slug) return <ErrorRoute error={t("missingSlug")} />
  if (!hasValidLoopback) return <ErrorRoute error={t("invalidRedirect")} />

  return (
    <AsyncRoute data={[page]}>
      <AppsInstallCard slug={slug} redirectUri={redirectUri} state={state} />
    </AsyncRoute>
  )
}
