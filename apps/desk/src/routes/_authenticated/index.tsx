import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { meQueryOptions } from "@/features/account"
import { HomePage, HomePageSkeleton } from "@/features/home"

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ context }) => context.queryClient.query({ ...meQueryOptions(), staleTime: "static" }),
  pendingComponent: HomePageSkeleton,
  errorComponent: RouteErrorState,
  component: HomeRoute,
})

function HomeRoute() {
  const { data: me } = useSuspenseQuery(meQueryOptions())
  return <HomePage projects={me.projects} />
}
