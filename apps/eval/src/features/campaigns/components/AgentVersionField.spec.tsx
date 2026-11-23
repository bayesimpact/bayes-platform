import { EvalAgentsRoutes } from "@caseai-connect/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { screen } from "@testing-library/react"
import { Suspense } from "react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"
import { buildAgentVersions, buildProjectAgent } from "@/test/factories/agents.factory"
import { buildMyOrganization, buildMyProject } from "@/test/factories/projects.factory"
import { mockRoute } from "@/test/msw/mock-route"
import { server } from "@/test/msw/server"
import { renderWithQueryClient } from "@/test/render-with-query-client"
import { campaignFormSchema } from "../schemas"
import { AgentVersionField } from "./AgentVersionField"

const agent = buildProjectAgent(buildMyProject(buildMyOrganization()))
const versions = buildAgentVersions(agent)
const agentParams = {
  organizationId: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  agentId: agent.id,
}

function Field({ isLocked }: { isLocked: boolean }) {
  const form = useForm({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      agentSettingsId: versions[1]?.id ?? "",
      name: "Campaign",
      description: "",
      testerPerSessionQuestions: [],
      testerEndOfPhaseQuestions: [],
      reviewerQuestions: [],
    },
  })
  return (
    <AgentVersionField
      control={form.control}
      agentParams={agentParams}
      agentName={agent.name}
      isLocked={isLocked}
    />
  )
}

function renderField(isLocked: boolean) {
  server.use(mockRoute(EvalAgentsRoutes.getVersions, () => versions))
  renderWithQueryClient(
    <Suspense fallback={null}>
      <Field isLocked={isLocked} />
    </Suspense>,
  )
}

describe("AgentVersionField", () => {
  it("opens the versions while the campaign can change", async () => {
    renderField(false)
    expect(await screen.findByRole("button", { name: "Choose a version" })).toBeEnabled()
  })

  it("offers no other version once the campaign is locked", async () => {
    renderField(true)
    expect(await screen.findByRole("button", { name: "Choose a version" })).toBeDisabled()
  })
})
