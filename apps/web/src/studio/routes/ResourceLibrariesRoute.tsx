import { useOutlet } from "react-router-dom"
import { useValue } from "@/common/hooks/use-value"
import { ResourceLibrariesManager } from "@/studio/features/resource-libraries/components/ResourceLibrariesManager"
import { selectResourceLibrariesData } from "@/studio/features/resource-libraries/resource-libraries.selectors"

export function ResourceLibrariesRoute() {
  const outlet = useOutlet()
  const resourceLibraries = useValue(selectResourceLibrariesData)
  if (outlet) return outlet
  return <ResourceLibrariesManager resourceLibraries={resourceLibraries} />
}
