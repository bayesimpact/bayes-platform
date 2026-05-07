import { outputJsonSchemaSchema, ToolName } from "@caseai-connect/api-contracts"
import type { JSONSchema7 } from "ai"
import { jsonSchema, tool } from "ai"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
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
  const validatedSchema = outputJsonSchemaSchema.parse(
    agent.outputJsonSchema,
  ) as unknown as JSONSchema7
  const inputSchema = jsonSchema<Record<string, unknown>>(validatedSchema)
  const outputSchema = jsonSchema<{ formState: Record<string, unknown> }>({
    type: "object",
    properties: {
      formState: {
        ...validatedSchema,
        description: "The current state of the form, with values filled by the user",
      },
    },
    required: ["formState"],
    additionalProperties: false,
  })

  return tool({
    description: "Fill out a form. Get the values from user's answers.",
    inputSchema,
    outputSchema,
    execute: async (input, _options) => {
      const { result: formState } = await formAgentSessionsService.updateSessionResult({
        connectScope,
        sessionId,
        input,
      })

      onExecute({ toolName: ToolName.FillForm, arguments: input })

      return { formState: formState ?? {} }
    },
  })
}
