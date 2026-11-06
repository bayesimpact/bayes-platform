import type { Job } from "bullmq"
import type { MaintenanceJob, MaintenanceJobPayload } from "./maintenance-job.interface"
import { MaintenanceJobsWorker } from "./maintenance-jobs.worker"

describe("MaintenanceJobsWorker", () => {
  const maintenanceJob: MaintenanceJob = {
    key: "sample-maintenance-job",
    title: "Sample maintenance job",
    description: "Moves sample records to their new shape.",
    preview: jest.fn(),
    run: jest.fn(async ({ reportProgress }) => {
      await reportProgress({ done: 1, total: 1 })
      return { summary: "1 record moved." }
    }),
  }

  const buildJob = (name: string) =>
    ({
      name,
      id: name,
      data: { requestedByUserId: "user-1" },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    }) as unknown as Job<MaintenanceJobPayload> & { updateProgress: jest.Mock }

  it("runs the job named by the BullMQ job and reports its progress", async () => {
    const worker = new MaintenanceJobsWorker([maintenanceJob])
    const job = buildJob(maintenanceJob.key)

    await expect(worker.process(job)).resolves.toEqual({ summary: "1 record moved." })
    expect(maintenanceJob.run).toHaveBeenCalledWith(
      expect.objectContaining({ requestedByUserId: "user-1" }),
    )
    expect(job.updateProgress).toHaveBeenCalledWith({ done: 1, total: 1 })
  })

  it("fails on a job that is not registered", async () => {
    const worker = new MaintenanceJobsWorker([maintenanceJob])

    await expect(worker.process(buildJob("removed-job"))).rejects.toThrow(
      "Unknown maintenance job: removed-job",
    )
  })
})
