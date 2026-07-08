import { outputJsonSchemaSchema, ToolName } from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import { castToolInputParameters } from "@/common/zod-helper"
import type { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import type { FormAgentSessionsService } from "@/domains/agents/form-agent-sessions/form-agent-sessions.service"
import type { AgentSessionScope } from "../streaming-session.types"
import { buildFormFieldsZodSchema } from "./form-schema.helper"
import type { ToolExecutionLog } from "./tool-execution-log"

export function fillFormTool({
  agentSessionScope,
  formAgentSessionsService,
  onExecute,
}: {
  agentSessionScope: AgentSessionScope
  formAgentSessionsService: FormAgentSessionsService
  onExecute: (toolExecution: ToolExecutionLog) => void
}) {
  const { agent, connectScope, session } = agentSessionScope
  const schema = outputJsonSchemaSchema.parse(agent.outputJsonSchema) // validate the schema from the agent definition

  const inputSchema = buildFormFieldsZodSchema(schema.properties)

  return tool({
    description: "Fill out a form. Get the values from user's answers.",
    inputSchema: z.object({
      formFields: inputSchema
        .describe(
          "The form fields to be filled, with values provided by the user at this point, meaning can be a partial set of fields.",
        )
        .optional(),
      getFormState: z.boolean().optional().describe("Whether to return the current form state."),
    }),
    outputSchema: z.object({
      formState: inputSchema.describe(
        "The current state of the form, with values filled by the user",
      ),
    }),
    execute: async (input, _options) => {
      if (input.formFields) {
        const typedInput = castToolInputParameters(input.formFields)
        const { result: formState } = await formAgentSessionsService.updateSessionResult({
          connectScope,
          sessionId: session.id,
          input: typedInput,
        })
        onExecute({ toolName: ToolName.FillForm, arguments: typedInput })
        return { formState }
      }

      onExecute({ toolName: ToolName.FillForm, arguments: {} })
      assertFormAgentSessionResult(agentSessionScope)
      return { formState: agentSessionScope.session.result || {} }
    },
  })
}

function assertFormAgentSessionResult(
  agentSessionScope: AgentSessionScope,
): asserts agentSessionScope is AgentSessionScope & {
  session: NonNullable<FormAgentSession>
} {
  const { session } = agentSessionScope
  if (!("type" in session)) {
    throw new Error("Agent session type is not initialized")
  }
  if (!("result" in session)) {
    throw new Error("Agent session result is not initialized")
  }
}
