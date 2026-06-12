import { ToolName } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { generateId } from "@/common/utils/generate-id"
import { formAgentSessionsActions } from "../../form/form-agent-sessions.slice"
import { buildType } from "../base-agent-session/base-agent-sessions.thunks"
import type { AgentSessionMessage } from "./agent-session-messages.models"
import { agentSessionMessagesActions } from "./agent-session-messages.slice"
import { streamChatResponse } from "./external/agent-session-messages-streaming"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listMessages = createAsyncThunk<AgentSessionMessage[], string, ThunkConfig>(
  "agentSessionMessages/listMessages",
  async (agentSessionId, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    const params = { organizationId, projectId, agentId }
    return services.agentSessionMessages.getAll({
      ...params,
      agentSessionId,
      payload: { type: buildType() },
    })
  },
)

export const getMessage = createAsyncThunk<AgentSessionMessage, string, ThunkConfig>(
  "agentSessionMessages/getMessage",
  async (messageId, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    const agentSessionId = getCurrentId({ state, name: "agentSessionId" })
    const params = { organizationId, projectId, agentId, agentSessionId }
    return services.agentSessionMessages.getOne({
      ...params,
      messageId,
      payload: { type: buildType() },
    })
  },
)

export const getAttachmentDocumentTemporaryUrl = createAsyncThunk<
  { url: string },
  { attachmentDocumentId: string },
  ThunkConfig
>(
  "agentSessionMessages/getAttachmentDocumentTemporaryUrl",
  async ({ attachmentDocumentId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    const agentSessionId = getCurrentId({ state, name: "agentSessionId" })
    const params = { organizationId, projectId, agentId, agentSessionId }
    return services.agentSessionMessages.getAttachmentDocumentTemporaryUrl({
      ...params,
      attachmentDocumentId,
      payload: { type: buildType() },
    })
  },
)

export const sendMessage = createAsyncThunk<
  void,
  { content: string; file?: File; onFillFormToolEvent?: () => void },
  ThunkConfig
>(
  "agentSessionMessages/sendMessage",
  async (
    { content, file, onFillFormToolEvent },
    { extra: { services }, dispatch, getState, signal },
  ) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    const agentSessionId = getCurrentId({ state, name: "agentSessionId" })

    // Guard: don't allow sending if already streaming
    if (state.agentSessionMessages.isStreaming) {
      return
    }

    const userMessageId = generateId()
    const assistantMessageId = generateId()

    let attachmentDocumentId: string | undefined

    if (file) {
      const attachmentDocument = await services.agentSessionMessages.uploadAttachmentDocument({
        organizationId,
        projectId,
        agentId,
        agentSessionId,
        file,
        payload: { type: buildType() },
      })
      attachmentDocumentId = attachmentDocument.attachmentDocumentId
    }

    const userMessage: AgentSessionMessage = {
      id: userMessageId,
      role: "user",
      content,
      attachmentDocumentId,
      createdAt: new Date().toISOString(),
    }

    dispatch(agentSessionMessagesActions.startStreaming({ userMessage, assistantMessageId }))

    try {
      await streamChatResponse({
        organizationId,
        projectId,
        agentId,
        agentSessionId,
        content,
        attachmentDocumentId,
        handlers: {
          onStart: (event) => {
            // Update the optimistic message ID to match the backend's ID
            dispatch(
              agentSessionMessagesActions.updateAssistantMessageId({
                oldMessageId: assistantMessageId,
                newMessageId: event.messageId,
              }),
            )
          },
          onChunk: (event) => {
            dispatch(
              agentSessionMessagesActions.appendAssistantChunk({
                messageId: event.messageId,
                chunk: event.content,
              }),
            )
          },
          onNotifyClient(event) {
            switch (event.toolName) {
              case ToolName.FillForm:
                if (onFillFormToolEvent) onFillFormToolEvent()
                // FIXME: should be replace by getOne
                else dispatch(formAgentSessionsActions.getAll({ agentId }))

                break

              default:
                break
            }
          },
          onEnd: async (event) => {
            dispatch(
              agentSessionMessagesActions.completeAssistantMessage({
                messageId: event.messageId,
                fullContent: event.fullContent,
              }),
            )
            dispatch(getMessage(event.messageId))
          },
          onError: (event) => {
            dispatch(
              agentSessionMessagesActions.failAssistantMessage({
                messageId: event.messageId,
                error: event.error,
              }),
            )
          },
        },
        signal,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to stream response"
      dispatch(
        agentSessionMessagesActions.failAssistantMessage({
          messageId: assistantMessageId,
          error: errorMessage,
        }),
      )
      throw error
    }
  },
)
