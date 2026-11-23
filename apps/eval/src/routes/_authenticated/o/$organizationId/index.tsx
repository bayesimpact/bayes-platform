import { createFileRoute, redirect } from "@tanstack/react-router"

/** An organization has no page of its own in the app: its projects are in the agent switcher. */
export const Route = createFileRoute("/_authenticated/o/$organizationId/")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true })
  },
})
