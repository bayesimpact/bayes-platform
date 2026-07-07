import { createContext, useContext } from "react"
import type { DeskRoutes } from "@/desk/routes/helpers"
import type { StudioRoutes } from "@/studio/routes/helpers"

type BuildProjectRoute = typeof StudioRoutes.project.build | typeof DeskRoutes.project.build
type BuildAgentRoute = typeof StudioRoutes.agent.build | typeof DeskRoutes.agent.build
type BuildAgentSessionRoute =
  | typeof StudioRoutes.agentSession.build
  | typeof DeskRoutes.agentSession.build
export type BuildAgentExtractionCsvRunRoute =
  | typeof StudioRoutes.agentExtractionCsvRun.build
  | typeof DeskRoutes.agentExtractionCsvRun.build

export type BuildAgentExtractionRunRoute =
  | typeof StudioRoutes.agentExtractionRun.build
  | typeof DeskRoutes.agentExtractionRun.build

export interface UseBuildRoutesContextValue {
  build: {
    projectRoute: BuildProjectRoute
    agentRoute: BuildAgentRoute
    agentSessionRoute: BuildAgentSessionRoute
    agentExtractionCsvRunRoute: BuildAgentExtractionCsvRunRoute
    agentExtractionRunRoute: BuildAgentExtractionRunRoute
  }
}

export const BuildRoutesContext = createContext<UseBuildRoutesContextValue | null>(null)

export function useRoutesBuilder() {
  const context = useContext(BuildRoutesContext)
  if (!context) {
    throw new Error("useRoutesBuilder must be used within a RoutesBuilderProvider")
  }
  return context
}
