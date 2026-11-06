import { Trans } from "@lingui/react/macro"
import { createFileRoute } from "@tanstack/react-router"

/** The app's home: a greeting for now. */
export const Route = createFileRoute("/_authenticated/")({
  component: HomeRoute,
})

function HomeRoute() {
  return (
    <main className="min-h-svh p-8">
      <h1 className="text-2xl font-semibold">
        <Trans>Hello world!</Trans>
      </h1>
    </main>
  )
}
