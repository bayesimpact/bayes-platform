import { outputJsonSchemaSchema, ToolName } from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { castToolInputParameters } from "@/common/zod-helper"
import type { AgentSessionScope } from "../streaming-session.types"
import { buildFormFieldsZodSchema } from "./form-schema.helper"
import type { ToolExecutionLog } from "./tool-execution-log"

/**
 * The slice of the session service the fillForm tool needs: merging partial
 * form input into the session's accumulated `result`.
 */
export type SessionResultUpdater = {
  updateSessionResult(params: {
    connectScope: RequiredConnectScope
    input: Record<string, unknown>
    sessionId: string
  }): Promise<{ result: Record<string, unknown> | null }>
}

export function fillFormTool({
  agentSessionScope,
  sessionResultUpdater,
  onExecute,
}: {
  agentSessionScope: AgentSessionScope
  sessionResultUpdater: SessionResultUpdater
  onExecute: (toolExecution: ToolExecutionLog) => void
}) {
  const { agentSettings, connectScope, session } = agentSessionScope
  const schema = outputJsonSchemaSchema.parse(agentSettings.outputJsonSchema) // validate the schema from the agent definition

  const inputSchema = buildFormFieldsZodSchema(schema)

  return tool({
    description: "Fill out a form. Get the values from user's answers.",
    inputSchema: z.object({
      formFields: inputSchema
        .describe(
          "The form fields to fill, populated with values found in the user's last answer. May be a partial set of fields.",
        )
        .optional(),
      getFormState: z
        .boolean()
        .optional()
        .describe(
          "If no formFields are provided, you can use this to return the current state of the form.",
        ),
    }),
    outputSchema: z.object({
      formState: inputSchema.describe(
        "The current state of the form, with values filled by the user",
      ),
    }),
    execute: async (input, _options) => {
      if (input.formFields) {
        const typedInput = castToolInputParameters(input.formFields)
        const { result: formState } = await sessionResultUpdater.updateSessionResult({
          connectScope,
          sessionId: session.id,
          input: typedInput,
        })
        onExecute({ toolName: ToolName.FillForm, arguments: typedInput })
        return { formState }
      }

      onExecute({ toolName: ToolName.FillForm, arguments: input })
      assertSessionSupportsFormResult(agentSessionScope)
      return { formState: agentSessionScope.session.result || {} }
    },
  })
}

/**
 * The fillForm tool only runs against persisted sessions carrying a `result`
 * column (not the public streaming session proxy).
 */
function assertSessionSupportsFormResult(
  agentSessionScope: AgentSessionScope,
): asserts agentSessionScope is AgentSessionScope & {
  session: AgentSessionScope["session"] & { result: Record<string, unknown> | null }
} {
  const { session } = agentSessionScope
  if (!("result" in session)) {
    throw new Error("Agent session result is not initialized")
  }
}
