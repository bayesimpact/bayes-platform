import { useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { Suspense } from "react"
import { appBasePath } from "@/app/config"
import { chooseLocale, LOCALES } from "@/app/i18n"
import { AppHeader } from "@/components/shared/AppHeader"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { meQueryOptions, UserMenu, UserMenuSkeleton } from "@/features/account"
import { hasSession, readLoginHint, signIn, signOut } from "@/lib/auth/session"

/** Every page of the Desk but the sign-in callback: a session, then the bar and the page. */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (await hasSession()) return
    await signIn({ returnTo: location.publicHref, loginHint: readLoginHint(location.searchStr) })
    // The provider's page replaces this one: wait for it rather than render the route.
    await new Promise<never>(() => {})
  },
  // The user menu must not block the page: its query starts here, unawaited, and the menu waits
  // for it in a Suspense of its own while the page shows its skeleton.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(meQueryOptions())
  },
  errorComponent: RouteErrorState,
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <div className="min-h-svh">
      <AppHeader
        logoUrl={`${appBasePath}theme/logo.svg`}
        actions={
          <Suspense fallback={<UserMenuSkeleton />}>
            <CurrentUserMenu />
          </Suspense>
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

function CurrentUserMenu() {
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
