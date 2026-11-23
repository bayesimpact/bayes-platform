import { useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Suspense } from "react"
import { appConfig, displayedVersion, platformHomePath } from "@/app/config"
import { activeLocaleOf, chooseLocale, LOCALES } from "@/app/i18n"
import { signOut } from "@/lib/auth/session"
import { meQueryOptions } from "../api/queries"
import { UserMenu } from "./UserMenu"
import { UserMenuSkeleton } from "./UserMenuSkeleton"

/**
 * The signed-in person's menu. It waits for the `me` query, which the authenticated layout loaded,
 * in a Suspense of its own, so it never blocks the page.
 */
export function CurrentUserMenu() {
  return (
    <Suspense fallback={<UserMenuSkeleton />}>
      <LoadedUserMenu />
    </Suspense>
  )
}

function LoadedUserMenu() {
  const { data: me } = useSuspenseQuery(meQueryOptions())
  const { i18n } = useLingui()
  return (
    <UserMenu
      user={me.user}
      locale={activeLocaleOf(i18n.locale)}
      locales={LOCALES}
      homeUrl={platformHomePath}
      helpCenterUrl={appConfig.helpCenterUrl ?? null}
      version={displayedVersion(appConfig) ?? null}
      onLocaleChange={(locale) => void chooseLocale(locale)}
      onSignOut={() => void signOut()}
    />
  )
}
