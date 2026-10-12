import { isAllowedInstallRedirectUri } from "@caseai-connect/api-contracts"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useParams, useSearchParams } from "react-router-dom"
import {
  selectAppInstallHasValidCallbackParams,
  selectAppInstallPage,
  selectAppInstallRedirectUri,
  selectAppInstallSlug,
} from "@/common/features/app-install/app-install.selectors"
import { appInstallActions } from "@/common/features/app-install/app-install.slice"
import { AppsInstallCard } from "@/common/features/app-install/components/AppsInstallCard"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
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
  const codeChallenge = searchParams.get("code_challenge") ?? ""
  const codeChallengeMethod = searchParams.get("code_challenge_method") ?? ""

  useEffect(() => {
    dispatch(
      appInstallActions.setCurrentIds({
        slug: slug ?? null,
        redirectUri,
        callbackState,
        codeChallenge,
        codeChallengeMethod,
      }),
    )
  }, [callbackState, codeChallenge, codeChallengeMethod, dispatch, redirectUri, slug])

  return slug ?? null
}

export function AppsInstallRoute() {
  const { t } = useTranslation("appInstall")
  const slugParam = useSetCurrentIds()
  const slug = useAppSelector(selectAppInstallSlug)
  const hasValidCallbackParams = useAppSelector(selectAppInstallHasValidCallbackParams)
  const page = useAppSelector(selectAppInstallPage)
  const idsReady = slug === slugParam

  useMount({
    actions: appInstallActions,
    condition: idsReady && !!slug && hasValidCallbackParams,
    refreshOn: [slug],
  })

  if (!idsReady) return <LoadingRoute />
  if (!slug) return <ErrorRoute error={t("missingSlug")} />
  if (!hasValidCallbackParams) return <ErrorRoute error={t("invalidRedirect")} />

  return (
    <AsyncRoute data={[page]}>
      <AllowedRedirectGate />
    </AsyncRoute>
  )
}

function AllowedRedirectGate() {
  const { t } = useTranslation("appInstall")
  const page = useValue(selectAppInstallPage)
  const redirectUri = useAppSelector(selectAppInstallRedirectUri)

  if (!isAllowedInstallRedirectUri(redirectUri, page.app.allowedRedirectUris)) {
    return <ErrorRoute error={t("unregisteredRedirect")} />
  }

  return <AppsInstallCard />
}
