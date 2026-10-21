import { useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Suspense } from "react"
import { chooseLocale, LOCALES } from "@/app/i18n"
import { signOut } from "@/lib/auth/session"
import { meQueryOptions } from "../api/queries"
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
  return (
    <UserMenu
      user={me.user}
      locale={i18n.locale}
      locales={LOCALES}
      onLocaleChange={(locale) => void chooseLocale(locale)}
      onSignOut={() => void signOut()}
    />
  )
}
