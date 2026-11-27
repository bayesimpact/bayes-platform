# Shared chat, PR 2: the chat object and the calls to the API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The chat's calls to the API live once, in `packages/chat`: its queries, its mutations, the stream of a reply and the upload of an attachment. Each app gives the package its routes, its API client and what it does when the chat moves.

**Architecture:** Each app calls `createChat` once, in `src/features/conversation/chat.ts`, and puts a `ChatProvider` around its signed-in pages. The object holds the query options and the functions that call the API; the package's hooks read it with `useChat()`. The app's loaders and its own mutations call the object directly. The chat's components stay in each app in this PR and call the package's hooks.

**Tech Stack:** React 19, TanStack Query 5, Zod 4, `@caseai-connect/api-client` (types, and the real client in the package's specs), MSW 2, Vitest with happy-dom, the React Compiler.

**Spec:** `docs/superpowers/specs/2026-11-26-shared-chat-design.md` (section 3, "The chat object", section 5, "Tests", and "Delivery", PR 2). PR 1's plan, `2026-11-26-shared-chat-pr1-texts-and-compositions.md`, lists what its review carried here.

## Global Constraints

- The repository is public: no client, no private repository, no internal URL, in code, commits or the PR.
- Never run `npm install`. A new dependency of a package is written in place in `package-lock.json`; `npm ls <name> -w <package>` then resolves it.
- In shell commands, write Evaluation's folder as `apps/ev?l`: the worktree's guard refuses its name spelled out. Run git from the worktree root, one command per call.
- A person sees no difference in either app. The route specs and the stories of both apps change by their imports only; a route spec that needs another change is a behaviour change: stop and report.
- `packages/chat` knows no app: no branch on an app's name, no import of an app, of the memory, the history or the campaigns, no route written by hand. It holds no text a screen shows in this PR.
- What an app gives the chat in this PR is of two kinds: where the API is (`routes`, `api`) and what the app does when the chat moves (`onToolCalled`, `onReplySettled`). The settings and the texts of the spec arrive with their users, in PR 3.
- The query keys keep their values of today: `["conversations", agentSessionId, "messages"]`, `["conversations", agentSessionId, "mcp-apps"]`, `["documents", documentId, "is-public"]`.
- `packages/chat` imports `@caseai-connect/api-client` for its types only (`import type`), and in its specs. Only `lib/api-client.ts` of an app creates a client.
- The package's specs mock the network with MSW, on the real client: they never stub `apiRequest`, `fetch` or TanStack Query.
- Gates before the PR: `npm run biome:check`, `npm run typecheck`, `npm run test -w @caseai-connect/chat`, `npm run check` and `npm run build` of both apps.
- Commits end with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. The work ends with `/end-feature`.
- Approving the spec gave the go for the governed files this PR edits: the Vitest configuration of `packages/chat`, `docs/frontend/shared-packages.md`, `docs/frontend/conventions.md`, both `AGENTS.md`, ADR 0031 (one amendment line), `.github/workflows/ci.yml` and `apps/api/Dockerfile` only if a step of the list's last section asks.

## Review Focus

1. **A person leaves a conversation while a reply streams, and comes back.** Expected: the stream stops, no failure shows, the messages load again from the API. Pinned in Task 2.
2. **The stream closes before the reply ends, or sends a frame that is not an event.** Expected: the reply shows as failed (`ended`, `contract`), with its retry, and the app's `onReplySettled` still runs once. Pinned in Task 2.
3. **An app's callback throws.** Expected: the reply still completes and the error is logged; a broken callback must not leave a reply streaming forever. Pinned in Task 2.
4. **A chat hook runs outside a `ChatProvider`.** Expected: an error that names the provider, at the first render, in place of a crash deep in a query. Pinned in Task 1.
5. **A cached conversation, or an invalidation of the app, no longer matches** because a query key changed. Expected: the keys of today. Pinned in Task 1.

## File Structure

```text
packages/chat/src/
  api/keys.ts                 the query keys of the chat (values unchanged)
  api/reply-streams.ts        createReplyStreams(): the streams of one chat object, by conversation
  api/queries.ts              the three query options, built on the routes and the client
  api/upload-attachment.ts    presign, then PUT the bytes
  api/stream-reply.ts         sends a message and streams the replies into the cache
  api/create-chat.ts          createChat(options): Chat
  api/mutations.ts            the hooks that call the API: send, feedback, open a document or a file
  chat-context.ts             the context and useChat()
  ChatProvider.tsx            the provider
  hooks/use-conversation-send.ts   moved from the apps
  form-tools.ts               isFormTool(toolName)
  test/                       the package's test kit: setup, MSW server, a typed route mock, a client
apps/<app>/src/features/conversation/
  chat.ts                     new: the app's chat object
  api/                        gone, but the Desk's mutations.ts, which keeps useStartConversation
  hooks/use-conversation-send.ts   gone
```

---

### Task 1: `createChat`, the provider and the queries

**Files:**
- Create: `packages/chat/src/api/keys.ts`, `api/reply-streams.ts`, `api/queries.ts`, `api/create-chat.ts`, `chat-context.ts`, `ChatProvider.tsx`, `packages/chat/src/test/setup.ts`, `test/server.ts`, `test/mock-route.ts`, `test/test-chat.ts`, and the specs `api/create-chat.spec.ts`, `ChatProvider.spec.tsx`
- Modify: `packages/chat/package.json`, `package-lock.json`, `packages/chat/vitest.config.ts`, `packages/chat/src/index.ts`, `packages/api-client/src/index.ts`

**Interfaces:**
- Produces, in `@caseai-connect/api-client`: `export type ApiClient = ReturnType<typeof createApiClient>`.
- Produces, exported by `@caseai-connect/chat`:

```ts
export type ChatApi = Pick<ApiClient, "apiRequest" | "apiStreamResponse"> & {
  readServerSentEvents: typeof readServerSentEvents // of @caseai-connect/api-client, type only
}
export type ChatOptions = {
  routes: { conversation: ConversationRoutes; documents: DocumentsRoutes }
  api: ChatApi
  /** Called each time the stream of a reply names a tool the agent calls. */
  onToolCalled?: (queryClient: QueryClient, conversation: ConversationParamsDto, toolName: string) => void
  /** Called once when a turn is over: its reply ended, failed or was stopped. */
  onReplySettled?: (queryClient: QueryClient, conversation: ConversationParamsDto) => void
}
export type Chat = {
  keys: typeof chatKeys
  messagesQueryOptions: (conversation: ConversationParamsDto) => /* queryOptions of ChatMessage[] */
  mcpAppsHtmlQueryOptions: (conversation: ConversationParamsDto) => /* queryOptions of McpAppHtmlOutputDto[] */
  documentIsPublicQueryOptions: (document: DocumentParamsDto) => /* queryOptions of boolean */
  stopReplyStream: (agentSessionId: string) => void
  // Task 2 adds streamReply; Task 3 adds sendFeedback, getDocumentUrl, getAttachmentUrl.
}
export function createChat(options: ChatOptions): Chat
export function ChatProvider(props: { chat: Chat; children: ReactNode }): ReactNode
export function useChat(): Chat
```

- `chatKeys` is `{ messages(agentSessionId), mcpApps(agentSessionId), documentIsPublic(documentId) }`, with the values of "Global Constraints".
- `createReplyStreams()` returns `{ register(agentSessionId): AbortController, unregister(agentSessionId, controller), isStreaming(agentSessionId), stop(agentSessionId) }`: the module-level map of today becomes the state of one chat object.
- The test kit: `test/test-chat.ts` exports `createTestChat(overrides?: Partial<ChatOptions>)`, which builds a chat on `createApiClient` with a session that always has a token, and on `conversationRoutesAt("test/organizations/:organizationId/projects/:projectId", "live")` and `documentsRoutesAt(...)`. `test/mock-route.ts` holds `mockRoute(route, resolver)` and `mockStreamRoute(route, frames)`, as `apps/desk/src/test/msw/mock-route.ts` does, for these routes only.

- [ ] **Step 1: Give the package its DOM tests.** In `vitest.config.ts`: `@vitejs/plugin-react` with `babel-plugin-react-compiler` (`panicThreshold: "all_errors"`, as `apps/desk/vite.config.ts`), `include` of `*.spec.ts` and `*.spec.tsx`, `setupFiles: ["src/test/setup.ts"]`. `setup.ts`: jest-dom, `cleanup`, the MSW server (`onUnhandledRequest: "error"`), an empty storage. Dev dependencies at the versions `apps/desk/package.json` declares, in the manifest and the lockfile. `@tanstack/react-query` becomes a peer.

- [ ] **Step 2: Write the failing tests**

`api/create-chat.spec.ts`:

```ts
it("keeps the query keys the apps' caches and invalidations use", () => {
  const chat = createTestChat()
  expect(chat.keys.messages("s1")).toEqual(["conversations", "s1", "messages"])
  expect(chat.keys.mcpApps("s1")).toEqual(["conversations", "s1", "mcp-apps"])
  expect(chat.keys.documentIsPublic("d1")).toEqual(["documents", "d1", "is-public"])
})

it("reads a conversation's messages through the app's routes and client", async () => {
  // mockRoute(routes.conversation.getMessages, ...) answers one user and one assistant message.
  // queryClient.fetchQuery(chat.messagesQueryOptions(conversation)) gives two ChatMessage,
  // the roles "user" then "assistant", and the request went to the route's path.
})

it("reads whether a cited document is public, and the HTML of the MCP Apps", async () => {
  // documentIsPublicQueryOptions gives true for { isPublicDocument: true };
  // mcpAppsHtmlQueryOptions gives the array the route answers.
})
```

`ChatProvider.spec.tsx`:

```tsx
it("gives the chat to the hooks under it", () => {
  // renderHook(() => useChat(), { wrapper: <ChatProvider chat={chat}> }) returns the same object.
})

it("says which provider is missing when a hook runs outside it", () => {
  expect(() => renderHook(() => useChat())).toThrow(/ChatProvider/)
})
```

Write each sketched test in full: no test is left as a comment.

- [ ] **Step 3: Run them.** `npx vitest run` in `packages/chat`. Expected: FAIL, the modules do not exist.
- [ ] **Step 4: Implement** `keys.ts`, `reply-streams.ts`, `queries.ts` (the three options of `apps/desk/src/features/conversation/api/queries.ts`, on `options.routes` and `options.api`, with the polling and the focus rule unchanged), `create-chat.ts`, `chat-context.ts`, `ChatProvider.tsx`, and export them from `index.ts` by name.
- [ ] **Step 5: Run** `npm run test -w @caseai-connect/chat` and `npm run typecheck`. Expected: PASS, the six earlier specs of the package included.
- [ ] **Step 6: Commit** — `feat: the chat object, its provider and its queries in @caseai-connect/chat`

---

### Task 2: The stream of a reply

**Files:**
- Create: `packages/chat/src/api/stream-reply.ts`, `api/upload-attachment.ts`, `form-tools.ts`, `api/stream-reply.spec.ts`
- Modify: `packages/chat/src/api/create-chat.ts`, `packages/chat/src/index.ts`

**Interfaces:**
- Consumes: `Chat`, `ChatOptions`, `createReplyStreams`, `createTestChat`, `mockRoute`, `mockStreamRoute` of Task 1.
- Produces, on `Chat`: `streamReply(queryClient: QueryClient, conversation: ConversationParamsDto, outgoing: OutgoingMessage): Promise<void>`.
- Produces: `export function isFormTool(toolName: string): boolean`, true for `TOOL_NAMES.fillForm` and `TOOL_NAMES.consolidateForm`.

The code is the Desk's `api/stream-reply.ts` and `api/upload-attachment.ts`, with three changes and no other: the route and the client come from the options; the two blocks that invalidate the Desk's history and memories become `onToolCalled(queryClient, conversation, toolName)` for each `notify_client` event, whatever the tool; the last line of `finally` becomes `onReplySettled(queryClient, conversation)`. Each callback runs inside a `try`: a callback that throws is logged with `console.error` and changes nothing else.

- [ ] **Step 1: Write the failing tests** in `api/stream-reply.spec.ts`, each on a mocked stream and a real `QueryClient`, reading the messages in the cache at the end:

```ts
it("writes the person's message, then the reply as its chunks come, then the persisted messages", ...)
it("opens a message of its own for a sub-agent that takes over", ...)
it("fails the reply as `ended` when the stream closes before its end", ...)          // Review Focus 2
it("fails the reply as `contract` on a frame that is not an event", ...)               // Review Focus 2
it("fails the reply as `unreachable` when the request fails", ...)
it("uploads an attachment first, and fails the reply as `upload` when the upload fails", ...)
it("stops without a failure when the person leaves, and loads the messages again", ...) // Review Focus 1
it("stops the first stream of a conversation when a second one starts", ...)
it("calls onToolCalled for each tool the stream names, with its name", ...)
it("calls onReplySettled once, after a reply that ended, failed or was stopped", ...)   // three cases
it("completes the reply and logs when a callback throws", ...)                          // Review Focus 3
```

For each: the frames the mock sends, and the `status`, `failure` and `content` expected of each message. Take the shape of the frames from `apps/desk/src/test/msw/handlers.ts` and from the reply stream's schema in `packages/chat-contracts`.

- [ ] **Step 2: Run them.** Expected: FAIL, `chat.streamReply` is not a function.
- [ ] **Step 3: Implement** `upload-attachment.ts`, `stream-reply.ts`, `form-tools.ts`; add `streamReply` to the object.
- [ ] **Step 4: Run** `npm run test -w @caseai-connect/chat`. Expected: PASS, with no warning in the output.
- [ ] **Step 5: Commit** — `feat: the stream of a reply in @caseai-connect/chat, with its specs`

---

### Task 3: The hooks that call the API

**Files:**
- Create: `packages/chat/src/api/mutations.ts`, `packages/chat/src/hooks/use-conversation-send.ts`, `api/mutations.spec.tsx`, `hooks/use-conversation-send.spec.tsx`
- Modify: `packages/chat/src/api/create-chat.ts`, `packages/chat/src/index.ts`

**Interfaces:**
- Consumes: `useChat`, `ChatProvider`, `createTestChat`, `mockRoute`.
- Produces, on `Chat`: `sendFeedback(conversation, { agentMessageId, feedback }): Promise<{ success: boolean }>`, `getDocumentUrl(conversation, documentId): Promise<string>`, `getAttachmentUrl(conversation, attachmentDocumentId): Promise<string>`.
- Produces the hooks, with the signatures the Desk's have today: `useSendMessage(conversation)`, `useSendFeedback(conversation)`, `useOpenDocument(conversation)`, `useOpenAttachment(conversation)`, `useConversationSend(conversation, messages)`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("sends a thumbs-up to the route of the message's feedback", ...)   // the body the route received
it("opens a cited document in the tab the click opened", ...)          // tab.location is the URL
it("sends the message with its annotations and ticked tasks, then clears them", ...)
it("sends a failed message again as it left the first time", ...)
```

- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** `mutations.ts` is the Desk's file without `useStartConversation`, on `useChat()`. `use-conversation-send.ts` is the Desk's file, on the package's `useSendMessage`.
- [ ] **Step 4: Run** `npm run test -w @caseai-connect/chat`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat: the chat's mutation hooks in @caseai-connect/chat`

---

### Task 4: The Desk uses the chat object

**Files:**
- Create: `apps/desk/src/features/conversation/chat.ts`
- Modify: `apps/desk/src/features/conversation/api/mutations.ts` (keeps `useStartConversation` only), `load-conversation.ts`, `index.ts`, the components and hooks of the feature that import `../api/*` or `use-conversation-send`, `apps/desk/src/routes/_authenticated.tsx`, `apps/desk/src/test/` (the helper that renders a component of the chat), `apps/desk/src/test/msw/handlers.ts` and `apps/desk/src/stories/Conversation.stories.tsx` if they import a moved module
- Delete: `api/keys.ts`, `api/queries.ts`, `api/reply-streams.ts`, `api/stream-reply.ts`, `api/upload-attachment.ts`, `hooks/use-conversation-send.ts`

**Interfaces:**
- Consumes: everything Tasks 1 to 3 export.
- Produces: `export const chat` in `features/conversation/chat.ts`, also exported by the feature's `index.ts`:

```ts
export const chat = createChat({
  routes: { conversation: DeskConversationsRoutes, documents: DeskDocumentsRoutes },
  api: { apiRequest, apiStreamResponse, readServerSentEvents },
  onToolCalled(queryClient, conversation, toolName) {
    if (isFormTool(toolName)) void invalidateAgentHistory(queryClient, conversation.agentId)
    if (MEMORY_TOOLS.has(toolName)) void invalidateMemories(queryClient, conversation.agentId)
  },
  onReplySettled(queryClient, conversation) {
    void invalidateAgentHistory(queryClient, conversation.agentId)
  },
})
```

- [ ] **Step 1: Run the Desk's specs on today's code** (`npm run test -w @caseai-connect/desk`). Expected: PASS. Keep the count: it is the net.
- [ ] **Step 2: Create `chat.ts`**, and put `<ChatProvider chat={chat}>` around the pages of `routes/_authenticated.tsx`. If dependency-cruiser refuses that import, stop and report: do not edit its configuration.
- [ ] **Step 3: Move every user to the package**: the hooks from `@caseai-connect/chat`, the query options and `stopReplyStream` from `chat`. `useStartConversation` calls `chat.streamReply`. Delete the six files.
- [ ] **Step 4: A component's spec gets the provider** from the test helper that renders it (`renderWithQueryClient` wraps its tree in `<ChatProvider chat={chat}>`), so no spec changes beyond that helper.
- [ ] **Step 5: Run** `npm run check -w @caseai-connect/desk` and `npm run build -w @caseai-connect/desk`. Expected: exit 0, the same count of tests as Step 1, route specs and stories unchanged beyond imports.
- [ ] **Step 6: Commit** — `refactor: the Desk's chat calls the API through @caseai-connect/chat`

---

### Task 5: Evaluation uses the chat object

**Files:**
- Create: `apps/eval/src/features/conversation/chat.ts`
- Modify: `load-conversation.ts`, `index.ts`, the feature's components and hooks, `apps/eval/src/features/campaign-test/components/TesterSessionPage.tsx`, the layout route of the signed-in pages, the test helper, `apps/eval/scripts/desk-parity.json`
- Delete: the whole `api/` folder of the feature, `hooks/use-conversation-send.ts`

**Interfaces:**
- Consumes: everything Tasks 1 to 3 export; the Desk's Task 4 as the model.
- Produces: Evaluation's `chat`, on `EvalConversationsRoutes` and `EvalDocumentsRoutes`. Its forms are a query of the tester's session, so its callbacks invalidate that query: `onToolCalled` when `isFormTool(toolName)`, and `onReplySettled`. The key must cover the session of the conversation and no more than the tester's sessions; use the narrowest key of `campaignTestKeys` the conversation's params can build, or a predicate on the session's id.
- Changes: `ConversationView`, `useConversationSend` and `TesterSessionPage` lose `onFormsChange`: the chat object's callbacks do what it did.

- [ ] **Step 1: Run Evaluation's specs on today's code.** Expected: PASS. Keep the count.
- [ ] **Step 2: Do in Evaluation what Task 4 did in the Desk**, with the differences above.
- [ ] **Step 3: Check the forms still refresh.** Find the spec that covers a form the agent fills in during a tester's session; it must pass unchanged. If none exists, add one to the route's spec: the stream names `fillForm`, and the forms button shows the new form without a reload.
- [ ] **Step 4: Run the parity check.** `npm run check:desk-parity -w apps/ev?l`. The moved files left both apps, and `ConversationView.tsx` lost a wanted difference. Read its report: every difference left must be one the baseline held, or the loss of `onFormsChange`. Then record with `-- --update`, and say in the commit what changed in the baseline.
- [ ] **Step 5: Run** `npm run check -w apps/ev?l` and its build. Expected: exit 0, the count of Step 1 (plus the spec of Step 3 if added).
- [ ] **Step 6: Commit** — `refactor: Evaluation's chat calls the API through @caseai-connect/chat`

---

### Task 6: The docs

**Files:**
- Modify: `docs/frontend/shared-packages.md`, `docs/frontend/conventions.md`, `apps/desk/AGENTS.md`, `apps/eval/AGENTS.md`, `docs/adr/0031-frontend-stack-for-agent-built-apps.md`, `apps/eval/scripts/check-desk-parity.mjs` (its header)

- [ ] **Step 1: `shared-packages.md`.** Row `chat`: it now holds the chat object, its provider, its queries, its mutation hooks and the stream of a reply. "May depend on": TanStack Query as a peer; `api-client` for its types. "Must not hold": a route written by hand, a client of its own (it calls the API through the routes and the client the app gives), a text shown to people, the app's configuration, what only one app shows. The row of `api-client`: `chat` imports its types.
- [ ] **Step 2: `conventions.md`**, "Network code": the chat's calls live in `packages/chat`, on the routes and the client the app gives in `features/conversation/chat.ts`; every other network call stays in `features/<feature>/api`.
- [ ] **Step 3: Both `AGENTS.md`.** The Desk's table of reference files names `src/features/conversation/api/stream-reply.ts` for "A stream": point it at `packages/chat/src/api/stream-reply.ts`. Describe `chat.ts` and the provider where each file describes the conversation. The parity check's header and both files say what is still copied: the components, and the hooks and helpers that show a text.
- [ ] **Step 4: ADR 0031**: one amendment line, and the paragraph "The shared chat logic" says the package now makes the chat's calls, through what the app gives.
- [ ] **Step 5: Run the gates** of "Global Constraints". Expected: all exit 0.
- [ ] **Step 6: Commit** — `docs: the chat object and the calls to the API in @caseai-connect/chat`

## What changed during execution

The reviews changed a few interfaces the tasks above describe. The code is the reference:

- `Chat` has no `keys` member. An app reads or invalidates a query of the chat through the `queryKey` of its query options (`chat.messagesQueryOptions(conversation).queryKey`). `packages/chat/src/api/keys.ts` stays internal, and `create-chat.spec.ts` pins the key values through the query options.
- `packages/chat/src/index.ts` exports only what an app imports. `Chat`, `ChatApi`, `ChatOptions` and `useSendMessage` are not exported: the apps call `useConversationSend`. Eight exports the move made internal left the index too: `applyReplyEvent`, `failStreamingReplies`, `newLocalMessageId`, `ReplyCursor`, `setAttachmentDocument`, `startTurn`, `quoteSourceOf` and `useAnnotations`.
- `ChatApi` and `ChatOptions` live in `packages/chat/src/api/chat-options.ts`, which removes a cycle of type imports through `create-chat.ts`.
- `sendFeedback` returns the output of the route `createMessageFeedback`, derived from its schema.
- The Desk's `useStartConversation` reads the chat with `useChat()`. The loaders and the routes' `onLeave` import the app's `chat`, since they run outside React.
- Each app's `src/stories/StoryProviders.tsx` gives the chat too.
- Evaluation's callbacks invalidate through `src/lib/tester-session-keys.ts`: the conversation's params name no campaign, and the conversation feature cannot import the campaign-test one.
- Each app's `src/test/msw/mock-route.ts` has `openMockStream`, for a spec that checks what a person sees while a reply is still being written.
- `@caseai-connect/api-client` is a peer dependency of `packages/chat`, which imports its types.
- A second reply started on a conversation while the first is open fails the first as ended. Both apps did this before; a spec records it, and issue #1327 tracks the fix.

## After this PR

PR 3 moves the components, the chat's catalog and its stylesheet, gives `createChat` the app's settings and texts, and ends the parity check. Its plan also takes what PR 1's plan carried: every pair of catalogs compared, `check-component-files` in the packages' checks, and the React Compiler in `packages/app-ui`'s Vitest (this PR gives it to `packages/chat`).
