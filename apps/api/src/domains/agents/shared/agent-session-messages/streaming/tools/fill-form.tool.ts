import { outputJsonSchemaSchema, ToolName } from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { castToolInputParameters, zNullableType } from "@/common/zod-helper"
import type { Agent } from "@/domains/agents/agent.entity"
import type { FormAgentSessionsService } from "@/domains/agents/form-agent-sessions/form-agent-sessions.service"
import type { ToolExecutionLog } from "./tool-execution-log"

export function fillFormTool({
  connectScope,
  agent,
  sessionId,
  formAgentSessionsService,
  onExecute,
}: {
  connectScope: RequiredConnectScope
  agent: Agent
  sessionId: string
  formAgentSessionsService: FormAgentSessionsService
  onExecute: (toolExecution: ToolExecutionLog) => void
}) {
  const schema = outputJsonSchemaSchema.parse(agent.outputJsonSchema) // validate the schema from the agent definition

  const inputSchema = buildInputSchemaForFormTool(schema.properties)

  return tool({
    description: "Fill out a form. Get the values from user's answers.",
    inputSchema,
    outputSchema: z.object({
      formState: inputSchema.describe(
        "The current state of the form, with values filled by the user",
      ),
    }),
    execute: async (input, _options) => {
      const typedInput = castToolInputParameters(input)
      const { result: formState } = await formAgentSessionsService.updateSessionResult({
        connectScope,
        sessionId,
        input: typedInput,
      })

      onExecute({ toolName: ToolName.FillForm, arguments: typedInput })

      return { formState }
    },
  })
}

// TODO: write a test for this method
function buildInputSchemaForFormTool(
  properties: z.infer<typeof outputJsonSchemaSchema>["properties"],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [key, value] of Object.entries(properties)) {
    const description = value.description || ""
    switch (value.type) {
      case "string":
        shape[key] = zNullableType(z.string(), description)
        break
      case "number":
        shape[key] = zNullableType(z.number(), description)
        break
      case "boolean":
        shape[key] = zNullableType(z.boolean(), description)
        break
      default:
        throw new Error(`Unsupported property type: ${value.type}`)
    }
  }
  return z.object(shape).strict()
}
