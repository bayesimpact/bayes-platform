import { useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Suspense, useState } from "react"
import { appConfig, displayedVersion, platformHomePath } from "@/app/config"
import { activeLocaleOf, chooseLocale, LOCALES } from "@/app/i18n"
import { signOut } from "@/lib/auth/session"
import { meQueryOptions } from "../api/queries"
import { EditNameDialog } from "./EditNameDialog"
import { UserMenu } from "./UserMenu"
import { UserMenuSkeleton } from "./UserMenuSkeleton"

/**
 * The signed-in person's menu. It waits for the `me` query, which the authenticated layout
 * prefetched, in a Suspense of its own, so it never blocks the page.
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
  const [isEditingName, setIsEditingName] = useState(false)
  return (
    <>
      <UserMenu
        user={me.user}
        locale={activeLocaleOf(i18n.locale)}
        locales={LOCALES}
        homeUrl={platformHomePath}
        helpCenterUrl={appConfig.helpCenterUrl ?? null}
        version={displayedVersion(appConfig) ?? null}
        onLocaleChange={(locale) => void chooseLocale(locale)}
        onEditName={() => setIsEditingName(true)}
        onSignOut={() => void signOut()}
      />
      <EditNameDialog name={me.user.name} isOpen={isEditingName} onOpenChange={setIsEditingName} />
    </>
  )
}
