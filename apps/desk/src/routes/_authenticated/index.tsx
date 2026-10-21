import { createFileRoute } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import {
  HomePage,
  HomePageSkeleton,
  myOrganizationsQueryOptions,
  myProjectsQueryOptions,
  useDeskProjects,
} from "@/features/home"

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query({ ...myProjectsQueryOptions(), staleTime: "static" }),
      context.queryClient.query({ ...myOrganizationsQueryOptions(), staleTime: "static" }),
    ]),
  pendingComponent: HomePageSkeleton,
  errorComponent: RouteErrorState,
  component: HomeRoute,
})

function HomeRoute() {
  const projects = useDeskProjects()
  return <HomePage projects={projects} />
}
