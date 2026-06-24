import { ExtractionAgentSessionExecuteWorker } from "./extraction-agent-session-execute.worker"
import type { ExtractionAgentSessionRunnerService } from "./extraction-agent-session-runner.service"

describe("ExtractionAgentSessionExecuteWorker", () => {
  it("delegates jobs to the runner service", async () => {
    const mockRunnerService = {
      runById: jest.fn().mockResolvedValue(undefined),
    } as unknown as ExtractionAgentSessionRunnerService

    const worker = new ExtractionAgentSessionExecuteWorker(mockRunnerService)

    const jobData = {
      extractionAgentSessionId: "extraction-agent-session-id",
      organizationId: "organization-id",
      projectId: "project-id",
    }
    const job = { data: jobData }

    await worker.process(job as never)

    expect(mockRunnerService.runById).toHaveBeenCalledWith(jobData)
  })
})
