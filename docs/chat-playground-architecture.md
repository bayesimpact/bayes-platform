# Chat Playground Architecture & Flow

This document explains how the chat playground works end-to-end, covering the API, persistence layer, streaming implementation, and frontend state management.

---

## Table of Contents

- [High-Level Flow](#high-level-flow)
- [Backend Architecture](#backend-architecture)
  - [Domain Overview](#domain-overview)
  - [Session Creation](#session-creation)
  - [Loading Messages](#loading-messages)
  - [Streaming a Response](#streaming-a-response)
  - [LLM Provider Integration](#llm-provider-integration)
- [Frontend Architecture](#frontend-architecture)
  - [State & Models](#state--models)
  - [Redux Thunks](#redux-thunks)
  - [Redux Reducers](#redux-reducers)
  - [Chat UI Component](#chat-ui-component)
  - [Streaming Implementation](#streaming-implementation)
- [Error Handling & Edge Cases](#error-handling--edge-cases)
- [Key Design Decisions](#key-design-decisions)

---

## High-Level Flow

1. **User opens a agent playground** (via `agentRoute` component)
2. **Frontend creates/fetches a chat session** for that agent
3. **Frontend loads existing messages** for that session
4. **User sends a message** from the chat UI
5. **API stores the user message and a placeholder assistant message** for streaming
6. **API calls the LLM and streams the answer** via Server-Sent Events (SSE)
7. **Frontend displays the streaming answer in real-time**, then finalizes it when the stream ends
8. **Errors** are persisted as messages and displayed clearly in the UI

---

## Backend Architecture

### Domain Overview

The chat playground is built on top of several core entities:

- **`agent`**: Configuration of a agent (model, temperature, default prompt, etc.)
- **`agentSession`**: A conversation between a user and a agent
  - Has a `type` field: `"playground"` or `"production"`
  - Contains a `messages` array (JSONB column) storing message objects
  - Playground sessions have a TTL (`expiresAt`) of 24 hours
- **`agentSessionMessage`**: Individual messages within a session
  - Fields: `id`, `role` ("user" | "assistant"), `content`, `status` ("streaming" | "completed" | "aborted" | "error"), `createdAt`, `startedAt`, `completedAt`

**Key Services & Controllers**:

- **`agentSessionsService`**: Core business logic for managing agent sessions
  - Creates playground sessions with authorization checks
  - Manages message persistence
  - Handles streaming lifecycle (prepare, finalize, error handling)
- **`ChatStreamingService`**: Orchestrates LLM streaming
  - Converts session messages to LLM format
  - Streams responses via SSE
  - Handles errors and completion
- **`AISDKLLMProvider`**: AI SDK integration layer
  - Adapts our normalized `ChatMessage[]` format to AI SDK calls
  - Uses Google Vertex AI (Gemini) via `@ai-sdk/google-vertex`

### Session Creation

When a user opens the playground:

1. **Route Definition** (in `api-contracts`):
   ```typescript
   agentSessionsRoutes.createPlaygroundSession
   // POST /chat-bots/:agentId/playground-session
   ```

2. **Controller** (`agentSessionsController.createPlaygroundSession`):
   - Protected by `JwtAuthGuard` and `UserGuard`
   - Extracts `agentId` from route params
   - Delegates to `agentSessionsService.createPlaygroundSessionForagent(agentId, userId)`

3. **Service** (`agentSessionsService.createPlaygroundSessionForagent`):
   - **Authorization**: Verifies user has access to the agent's organization
     - Checks agent exists
     - Verifies user is a member of the agent's project's organization
     - Requires `"owner"` or `"admin"` role
   - **Session Management**:
     - Looks for existing playground session for this user + agent
     - If exists and TTL not expired: returns existing session
     - If exists but TTL expired: resets messages and updates TTL
     - If doesn't exist: creates new session with 24-hour TTL
   - Returns `agentSession` DTO

### Loading Messages

1. **Route Definition**:
   ```typescript
   AgentSessionMessagesRoutes.listMessages
   // GET /agent-sessions/:sessionId/messages
   ```

2. **Controller** (`agentSessionMessagesController.listMessages`):
   - Protected by `JwtAuthGuard` and `UserGuard`
   - Extracts `sessionId` from route params
   - Delegates to `agentSessionsService.listMessagesForSession(sessionId, userId)`

3. **Service** (`agentSessionsService.listMessagesForSession`):
   - **Authorization**: Verifies user has access to the session's organization
     - Checks session exists
     - Verifies user is a member of the session's organization
   - Returns array of `agentSessionMessageDto` objects

### Streaming a Response

#### Entry Point

The playground chat uses a **streaming endpoint** for LLM responses:

- **Route**: `GET /agent-sessions/:sessionId/stream?q=<userMessage>`
- **Controller**: `agentSessionStreamingController.streamPlayground`
  - Decorated with `@Sse()` for Server-Sent Events
  - Protected by `JwtAuthGuard` and `UserGuard`
  - Returns `Observable<MessageEvent>` (required by NestJS SSE)

#### Streaming Flow (`ChatStreamingService.streamChatResponse`)

The streaming service orchestrates the entire flow:

**Step 1: Prepare Session for Streaming**

```typescript
const { session: updatedSession, assistantMessageId } =
  await this.agentSessionsService.prepareForStreaming(session.id, userContent)
```

- `prepareForStreaming`:
  - Loads the session (throws `NotFoundException` if missing)
  - Appends two messages:
    - **User message**: `{ id, role: "user", content: userContent, createdAt }`
    - **Assistant message placeholder**: `{ id, role: "assistant", status: "streaming", content: "" }`
  - Persists the updated session
  - Returns the updated session and `assistantMessageId` (used for SSE events and DB updates)

**Step 2: Send Start Event**

```typescript
yield {
  data: JSON.stringify({
    type: "start",
    messageId: assistantMessageId,
  }),
} as MessageEvent
```

- Sends a "start" event immediately to the frontend
- Contains the backend-generated `assistantMessageId`
- Allows frontend to update optimistic message ID to match backend

**Step 3: Convert Messages to LLM Format**

```typescript
const llmMessages = this.convertToLLMFormat(updatedSession.messages)
```

- Filters messages:
  - Skips messages with `status === "streaming"` (incomplete)
  - Skips messages with `status === "aborted"`
  - Skips messages with empty/whitespace content (Gemini requires non-empty input)
- Maps to normalized `ChatMessage[]` format:
  ```typescript
  { role: "user" | "assistant", content: string }
  ```

**Step 4: Build LLM Config**

```typescript
const llmConfig = this.buildLLMConfig(agent)
```

- Extracts configuration from agent:
  - `model` (e.g., `"models/gemini-2.5-flash"`)
  - `temperature` (parsed to number, validated to be between 0-2)
  - `systemPrompt` (from `agentSettings.instructions` in the last revision)

**Step 5: Stream Response from LLM**

```typescript
for await (const chunk of this.llmProvider.streamChatResponse(llmMessages, llmConfig)) {
  fullContent += chunk

  yield {
    data: JSON.stringify({
      type: "chunk",
      content: chunk,
      messageId: assistantMessageId,
    }),
  } as MessageEvent
}
```

- Streams incremental text chunks from the LLM
- Each SSE event contains:
  - `type: "chunk"`
  - `content`: Partial text chunk
  - `messageId`: Links chunk to the assistant message in DB

**Step 6: Finalize Success**

```typescript
await this.agentSessionsService.finalizeStreaming(
  updatedSession.id,
  assistantMessageId,
  fullContent,
)

yield {
  data: JSON.stringify({
    type: "end",
    messageId: assistantMessageId,
    fullContent,
  }),
} as MessageEvent
```

- `finalizeStreaming`:
  - Updates assistant message:
    - `content = fullContent`
    - `status = "completed"`
    - `completedAt = now`
- Sends final "end" event to client

**Step 7: Error Handling**

```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

  await this.agentSessionsService.markStreamingError(
    updatedSession.id,
    assistantMessageId,
    errorMessage,
  )

  yield {
    data: JSON.stringify({
      type: "error",
      messageId: assistantMessageId,
      error: errorMessage,
    }),
  } as MessageEvent

  throw error
}
```

- `markStreamingError`:
  - Updates assistant message:
    - `status = "error"`
    - `content = error message`
    - `completedAt = now`
- Sends "error" event to client
- Frontend displays error message inline in chat

### LLM Provider Integration (`AISDKLLMProvider`)

The LLM provider bridges our normalized message format with the AI SDK:

- **Setup**: Uses `@ai-sdk/google-vertex` with project/location from environment variables
- **Streaming** (`streamChatResponse`):
  - Filters out:
    - System messages (handled separately via `system` parameter)
    - Messages with empty/whitespace content
  - Builds `messages` array for `streamText` call
  - Sets `system` parameter from `config.systemPrompt`
  - Streams `result.textStream` and yields plain text chunks

---

## Frontend Architecture

### State & Models

**Redux State** (`agentSession` slice):

```typescript
type agentSessionState = {
  session: agentSession | null
  messages: agentSessionMessage[]
  status: "idle" | "loading" | "succeeded" | "failed"
  error: string | null
  isStreaming: boolean
  currentAssistantMessageId: string | null
}
```

**Message Model**:

```typescript
type agentSessionMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  status?: "streaming" | "completed" | "aborted" | "error"
  createdAt?: string
  completedAt?: string
}
```

### Redux Thunks

**1. Create Playground Session**

```typescript
export const createPlaygroundSession = createAsyncThunk<agentSession, void, ThunkConfig>(
  "agentSession/createPlaygroundSession",
  async (_, { extra: { services }, getState }) => {
    const agentId = getState().agents.currentagentId!
    return services.agentSession.createPlaygroundSession(agentId)
  },
)
```

- Reads `currentagentId` from `agents` slice
- Calls API to create/fetch playground session
- Automatically triggers `loadSessionMessages` via middleware (see below)

**2. Load Session Messages**

```typescript
export const loadSessionMessages = createAsyncThunk<
  agentSessionMessage[],
  string,
  ThunkConfig
>("agentSession/loadSessionMessages", async (sessionId, { extra: { services } }) => {
  return services.agentSession.getMessages(sessionId)
})
```

- Fetches messages for a session
- Called automatically after session creation via middleware

**3. Send Message**

```typescript
export const sendMessage = createAsyncThunk<
  void,
  { sessionId: string; content: string },
  ThunkConfig
>("agentSession/sendMessage", async ({ sessionId, content }, { dispatch, getState, signal }) => {
  const state = getState()
  const agentSessionState = state.agentSession

  // Guard: don't allow sending if already streaming
  if (agentSessionState.isStreaming) {
    return
  }

  // Generate IDs for optimistic updates
  const userMessageId = v4()
  const assistantMessageId = v4()

  // Create user message
  const userMessage: agentSessionMessage = {
    id: userMessageId,
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  }

  // Dispatch start streaming action (adds both messages optimistically)
  dispatch(agentSessionActions.startStreaming({ userMessage, assistantMessageId }))

  try {
    // Stream the response
    await streamChatResponse(
      sessionId,
      content,
      {
        onStart: (event) => {
          // Update optimistic message ID to match backend's ID
          dispatch(
            agentSessionActions.updateAssistantMessageId({
              oldMessageId: assistantMessageId,
              newMessageId: event.messageId,
            }),
          )
        },
        onChunk: (event) => {
          dispatch(
            agentSessionActions.appendAssistantChunk({
              messageId: event.messageId,
              chunk: event.content,
            }),
          )
        },
        onEnd: (event) => {
          dispatch(
            agentSessionActions.completeAssistantMessage({
              messageId: event.messageId,
              fullContent: event.fullContent,
            }),
          )
        },
        onError: (event) => {
          dispatch(
            agentSessionActions.failAssistantMessage({
              messageId: event.messageId,
              error: event.error,
            }),
          )
        },
      },
      signal,
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to stream response"
    dispatch(
      agentSessionActions.failAssistantMessage({
        messageId: assistantMessageId,
        error: errorMessage,
      }),
    )
    throw error
  }
})
```

- **Concurrency Guard**: Checks `isStreaming` to prevent multiple simultaneous streams
- **Optimistic Updates**: Creates user and assistant messages immediately
- **ID Synchronization**: Updates optimistic assistant message ID when backend sends "start" event
- **Streaming Handlers**: Dispatches actions for chunks, completion, and errors

### Redux Reducers

**Key Reducers**:

- `createPlaygroundSession.pending/fulfilled/rejected`:
  - Tracks `status`, `error`
  - Sets `session` on success
  - Clears `messages` on new session creation
- `loadSessionMessages.pending/fulfilled/rejected`:
  - Sets `messages` array from API
  - Handles loading and error states
- `startStreaming`:
  - Sets `isStreaming = true`
  - Adds user message and empty assistant message to `messages`
  - Sets `currentAssistantMessageId`
- `updateAssistantMessageId`:
  - Updates optimistic assistant message ID to match backend's ID
- `appendAssistantChunk`:
  - Appends text chunk to assistant message content
- `completeAssistantMessage`:
  - Sets assistant message `status = "completed"`
  - Sets `content = fullContent`
  - Sets `isStreaming = false`
- `failAssistantMessage`:
  - Sets assistant message `status = "error"`
  - Sets `content = error message`
  - Sets `isStreaming = false`

**Middleware Integration**:

A Redux listener middleware automatically loads messages after session creation:

```typescript
listenerMiddleware.startListening({
  actionCreator: createPlaygroundSession.fulfilled,
  effect: async (action, listenerApi) => {
    const session = action.payload
    await listenerApi.dispatch(loadSessionMessages(session.id))
  },
})
```

### Chat UI Component (`agent`)

The main chat UI component:

- **State Selection**:
  ```typescript
  const messages = useAppSelector((state) => state.agentSession.messages)
  const session = useAppSelector((state) => state.agentSession.session)
  const isStreaming = useAppSelector((state) => state.agentSession.isStreaming)
  ```

- **Message Rendering**:
  - Maps `messages` array to UI components
  - User messages → `ChatUserMessage`
  - Assistant messages → `agentMessage`
  - Error messages → Red styling with `AlertCircleIcon` and "Error" label

- **Submit Handler**:
  ```typescript
  const handleSubmit = (message: string) => {
    if (!session || isStreaming || !message.trim()) {
      return
    }
    void dispatch(sendMessage({ sessionId: session.id, content: message.trim() }))
  }
  ```

- **Input Disabled State**:
  - Disables input and submit button when `isStreaming === true` or `session === null`

### Streaming Implementation

**Custom SSE Client** (`chat-session-streaming.ts`):

The frontend uses a **custom `fetch`-based SSE client** (instead of `EventSource`) to support Authorization headers:

```typescript
export async function streamChatResponse(
  sessionId: string,
  userMessage: string,
  handlers: StreamEventHandler,
  abortSignal?: AbortSignal,
): Promise<void>
```

**Implementation Details**:

1. **Request Setup**:
   - Constructs URL: `/agent-sessions/:sessionId/stream?q=<encodedMessage>`
   - Adds `Authorization: Bearer <token>` header
   - Sets `Accept: "text/event-stream"`

2. **Stream Reading**:
   - Uses `response.body.getReader()` to read chunks
   - Uses `TextDecoder` to decode bytes to text
   - Maintains a buffer for incomplete SSE events

3. **Event Parsing**:
   - Splits buffer by `\n\n` (SSE event separator)
   - Extracts `data: ...` lines
   - Parses JSON payload

4. **Event Handling**:
   - `"start"` → Calls `handlers.onStart` (updates message ID)
   - `"chunk"` → Calls `handlers.onChunk` (appends text)
   - `"end"` → Calls `handlers.onEnd` (finalizes message)
   - `"error"` → Calls `handlers.onError` (displays error)

**Concurrency Control**:

- The `sendMessage` thunk checks `isStreaming` before starting a new stream
- If already streaming, the thunk returns early
- This ensures only one LLM response is in-flight per session

**Optimistic UI Updates**:

- When user sends a message:
  - User message is added to UI immediately
  - Empty assistant message is shown with "streaming" status
  - As chunks arrive, assistant message content is appended in real-time
  - When stream completes, message is finalized with full content
- The backend persists all messages, so refreshing the page shows the same history

**Error Display**:

- If streaming fails or LLM returns an error:
  - Backend persists assistant message with `status: "error"` and `content = error message`
  - Frontend displays error message in red with error icon
  - `isStreaming` is set to `false`, allowing user to send a new message

---

## Error Handling & Edge Cases

### Authorization

All endpoints are protected:

- **Session Creation**: Requires user to be `"owner"` or `"admin"` of agent's organization
- **Message Listing**: Requires user to be a member of session's organization
- **Streaming**: Requires user to own the session (`session.userId === user.id`)

### Invalid LLM Configuration

- **Temperature Validation**: Parsed to number and validated to be between 0-2
- **Empty Messages**: Filtered out before calling LLM (Gemini requires non-empty input)
- **No Valid Messages**: Throws clear error if no valid messages remain after filtering

### Network & SSE Issues

- **Non-200 Responses**: Caught by frontend SSE client, displayed as error message
- **Aborted Streams**: Handled via `AbortSignal`, frontend can cancel in-flight requests
- **Stream Timeouts**: Backend marks old "streaming" messages as "aborted" after 5 minutes

### Message Recovery

- **Aborted Stream Recovery**: When loading a session, backend checks for old "streaming" messages and marks them as "aborted"
- **TTL Expiration**: Playground sessions expire after 24 hours, messages are reset when session is reused

---

## Key Design Decisions

### Why SSE Instead of WebSockets?

- **Simplicity**: SSE is unidirectional (server → client), perfect for streaming responses
- **HTTP-based**: Works with existing HTTP infrastructure, easier to debug
- **Automatic Reconnection**: Browsers handle SSE reconnection automatically
- **No Extra Protocol**: No need for WebSocket upgrade handshake

### Why Optimistic Updates?

- **Better UX**: User sees their message immediately, doesn't wait for server round-trip
- **Real-time Feel**: Assistant message appears immediately, creating a "typing" effect
- **ID Synchronization**: Frontend generates optimistic IDs, backend sends canonical IDs via "start" event

### Why Persist Messages Before Streaming?

- **Durability**: User message is saved even if stream fails
- **Recovery**: Can recover from crashes by reloading session
- **History**: Full conversation history is always available

### Why Filter Empty Messages?

- **LLM Requirements**: Google Gemini API requires non-empty `parts` field in messages
- **Data Quality**: Empty messages don't contribute to conversation context
- **Error Prevention**: Prevents API errors from malformed requests

### Why Separate Streaming Controller?

- **Separation of Concerns**: Streaming logic is isolated from regular CRUD operations
- **Different Response Type**: SSE responses don't follow standard JSON response format
- **Easier Testing**: Can test streaming independently from other endpoints

---

## Summary

The chat playground is built on a solid foundation of:

- **Type-safe API contracts** (via `api-contracts` package)
- **Authorization at every layer** (guards, service checks)
- **Optimistic UI updates** for instant feedback
- **Real-time streaming** via SSE
- **Robust error handling** with inline error messages
- **Message persistence** for conversation history

The architecture separates concerns cleanly:
- **Backend**: Domain logic, LLM integration, persistence
- **Frontend**: State management, UI rendering, streaming client
- **Contracts**: Shared types and routes between API and frontend

This design ensures maintainability, type safety, and a great user experience.
