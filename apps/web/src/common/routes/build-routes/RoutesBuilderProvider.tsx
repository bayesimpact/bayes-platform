import { BuildRoutesContext, type UseBuildRoutesContextValue } from "./context"

export function RoutesBuilderProvider({
  children,
  build,
}: React.ComponentProps<"div"> & {
  build: UseBuildRoutesContextValue["build"]
}) {
  return <BuildRoutesContext.Provider value={{ build }}>{children}</BuildRoutesContext.Provider>
}
