import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useParams, useSearchParams } from "react-router-dom"
import {
  selectAppInstallHasValidLoopback,
  selectAppInstallPage,
  selectAppInstallSlug,
} from "@/common/features/app-install/app-install.selectors"
import { appInstallActions } from "@/common/features/app-install/app-install.slice"
import { AppsInstallCard } from "@/common/features/app-install/components/AppsInstallCard"
import { useMount } from "@/common/hooks/use-mount"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "./AsyncRoute"
import { ErrorRoute } from "./ErrorRoute"
import { LoadingRoute } from "./LoadingRoute"

function useSetCurrentIds() {
  const dispatch = useAppDispatch()
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const redirectUri = searchParams.get("redirect_uri") ?? ""
  const callbackState = searchParams.get("state") ?? ""

  useEffect(() => {
    dispatch(
      appInstallActions.setCurrentIds({
        slug: slug ?? null,
        redirectUri,
        callbackState,
      }),
    )
  }, [callbackState, dispatch, redirectUri, slug])

  return slug ?? null
}

export function AppsInstallRoute() {
  const { t } = useTranslation("appInstall")
  const slugParam = useSetCurrentIds()
  const slug = useAppSelector(selectAppInstallSlug)
  const hasValidLoopback = useAppSelector(selectAppInstallHasValidLoopback)
  const page = useAppSelector(selectAppInstallPage)
  const idsReady = slug === slugParam

  useMount({
    actions: appInstallActions,
    condition: idsReady && !!slug && hasValidLoopback,
    refreshOn: [slug],
  })

  if (!idsReady) return <LoadingRoute />
  if (!slug) return <ErrorRoute error={t("missingSlug")} />
  if (!hasValidLoopback) return <ErrorRoute error={t("invalidRedirect")} />

  return (
    <AsyncRoute data={[page]}>
      <AppsInstallCard />
    </AsyncRoute>
  )
}
