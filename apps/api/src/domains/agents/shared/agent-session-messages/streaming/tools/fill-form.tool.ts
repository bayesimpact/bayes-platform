import { outputJsonSchemaSchema, ToolName } from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { castToolInputParameters } from "@/common/zod-helper"
import type { AgentSessionScope } from "../streaming-session.types"
import { buildFormFieldsZodSchema } from "./form-schema.helper"
import type { ToolExecutionLog } from "./tool-execution-log"

/**
 * The slice of ConversationFormsService the fillForm tool needs: the form of
 * the agent in the session, and the field-by-field merge into it.
 */
export type ConversationFormStore = {
  findOne(params: {
    connectScope: RequiredConnectScope
    sessionId: string
    agentId: string
  }): Promise<{ state: Record<string, unknown> } | null>
  mergeFields(params: {
    connectScope: RequiredConnectScope
    sessionId: string
    agentId: string
    agentSettingsId: string
    fields: Record<string, unknown>
  }): Promise<{ state: Record<string, unknown> }>
}

export function fillFormTool({
  agentSessionScope,
  conversationFormStore,
  onExecute,
}: {
  agentSessionScope: AgentSessionScope
  conversationFormStore: ConversationFormStore
  onExecute: (toolExecution: ToolExecutionLog) => void
}) {
  const { agent, agentSettings, connectScope, session } = agentSessionScope
  const schema = outputJsonSchemaSchema.parse(agentSettings.outputJsonSchema) // validate the schema from the agent definition

  const inputSchema = buildFormFieldsZodSchema(schema)
  // The form is the one this agent fills in this session: a sub-agent running
  // in its parent's session gets its own form there.
  const formKey = { connectScope, sessionId: session.id, agentId: agent.id }

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
        const { state } = await conversationFormStore.mergeFields({
          ...formKey,
          agentSettingsId: agentSettings.id,
          fields: typedInput,
        })
        await onExecute({ toolName: ToolName.FillForm, arguments: typedInput })
        return { formState: state }
      }

      await onExecute({ toolName: ToolName.FillForm, arguments: input })
      const form = await conversationFormStore.findOne(formKey)
      return { formState: form?.state ?? {} }
    },
  })
}
