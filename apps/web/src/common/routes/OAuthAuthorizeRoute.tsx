import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"
import { OAuthConsentCard } from "@/common/features/oauth-consent/components/OAuthConsentCard"
import {
  selectOAuthConsentPage,
  selectOAuthConsentRequest,
  selectOAuthConsentSearch,
} from "@/common/features/oauth-consent/oauth-consent.selectors"
import { oauthConsentActions } from "@/common/features/oauth-consent/oauth-consent.slice"
import { useMount } from "@/common/hooks/use-mount"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "./AsyncRoute"
import { ErrorRoute } from "./ErrorRoute"
import { LoadingRoute } from "./LoadingRoute"

function useSetCurrentIds() {
  const dispatch = useAppDispatch()
  const { search } = useLocation()

  useEffect(() => {
    dispatch(oauthConsentActions.setRequest({ search }))
  }, [dispatch, search])

  return search
}

/**
 * Authorization endpoint of the OAuth server (ADR 0028). The API checks the request before the
 * page shows anything: until then, a bad request shows an error and never redirects.
 */
export function OAuthAuthorizeRoute() {
  const { t } = useTranslation("oauthConsent")
  const search = useSetCurrentIds()
  const storedSearch = useAppSelector(selectOAuthConsentSearch)
  const request = useAppSelector(selectOAuthConsentRequest)
  const page = useAppSelector(selectOAuthConsentPage)
  const requestReady = storedSearch === search

  useMount({
    actions: oauthConsentActions,
    condition: requestReady && !!request,
    refreshOn: [storedSearch],
  })

  if (!requestReady) return <LoadingRoute />
  if (!request) return <ErrorRoute error={t("invalidRequest")} />

  return (
    <AsyncRoute data={[page]}>
      <OAuthConsentCard request={request} />
    </AsyncRoute>
  )
}
