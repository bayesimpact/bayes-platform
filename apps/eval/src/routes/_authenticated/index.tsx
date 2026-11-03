import { createFileRoute } from "@tanstack/react-router"

/** The app's home: a blank page for now. */
export const Route = createFileRoute("/_authenticated/")({
  component: HomeRoute,
})

function HomeRoute() {
  return <main className="min-h-svh" />
}
