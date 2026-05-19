import { useCallback } from "react"
import { useParams } from "react-router-dom"
import { useRoutesBuilder } from "../routes/build-routes/context"
import { assert } from "../utils/assert"

export function useGetProjectRoute() {
  const { organizationId, projectId } = useParams<{
    organizationId: string
    projectId: string
  }>()

  const { build } = useRoutesBuilder()

  return useCallback((): string => {
    assert(organizationId, "organizationId is required")
    assert(projectId, "projectId is required")
    return build.projectRoute({ organizationId, projectId })
  }, [organizationId, projectId, build.projectRoute])
}

export function useGetAgentRoute() {
  const { organizationId, projectId, agentId } = useParams<{
    organizationId: string
    projectId: string
    agentId: string
  }>()

  const { build } = useRoutesBuilder()

  return useCallback((): string => {
    assert(organizationId, "organizationId is required")
    assert(projectId, "projectId is required")
    assert(agentId, "agentId is required")
    return build.agentRoute({ organizationId, projectId, agentId })
  }, [organizationId, projectId, agentId, build.agentRoute])
}

export function useGetAgentSessionRoute() {
  const { organizationId, projectId, agentId, agentSessionId } = useParams<{
    organizationId: string
    projectId: string
    agentId: string
    agentSessionId: string
  }>()

  const { build } = useRoutesBuilder()

  return useCallback((): string => {
    assert(organizationId, "organizationId is required")
    assert(projectId, "projectId is required")
    assert(agentId, "agentId is required")
    assert(agentSessionId, "agentSessionId is required")
    return build.agentSessionRoute({ organizationId, projectId, agentId, agentSessionId })
  }, [organizationId, projectId, agentId, agentSessionId, build.agentSessionRoute])
}
