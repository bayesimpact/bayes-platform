import { z } from "zod"

/** The params of the routes under one fact an agent remembers about the person. */
export const memoryParamsSchema = z.strictObject({
  organizationId: z.uuid(),
  projectId: z.uuid(),
  agentId: z.uuid(),
  memoryId: z.uuid(),
})

/**
 * A fact an agent remembers about the signed-in person across conversations. A `pending` fact
 * is a proposal the person has not answered yet.
 */
export const memoryOutputSchema = z.object({
  id: z.uuid(),
  content: z.string(),
  status: z.enum(["pending", "saved"]),
  createdAt: z.number(),
})

export type MemoryOutputDto = z.output<typeof memoryOutputSchema>

/** The longest fact a person can write when they reword a proposal. */
export const MEMORY_MAX_LENGTH = 300

/** The person's answer to the facts an agent proposes to remember. */
export const resolveMemoryProposalsInputSchema = z.strictObject({
  decisions: z
    .array(
      z.strictObject({
        memoryId: z.uuid(),
        decision: z.enum(["save", "reject"]),
        /** The fact, reworded by the person, to save instead of the proposal. */
        content: z.string().trim().min(1).max(MEMORY_MAX_LENGTH).optional(),
      }),
    )
    .min(1)
    .max(20),
})

export type ResolveMemoryProposalsInputDto = z.input<typeof resolveMemoryProposalsInputSchema>

/** What the `saveMemory` tool returns: the facts it saved or proposes. */
export const saveMemoryResultSchema = z.object({
  memories: z.array(z.object({ id: z.uuid(), content: z.string() })),
})
