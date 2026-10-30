import { createFileRoute, redirect } from "@tanstack/react-router"

/** An organization has no page of its own in the Desk: its projects are on the home. */
export const Route = createFileRoute("/_authenticated/o/$organizationId/")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true })
  },
})
