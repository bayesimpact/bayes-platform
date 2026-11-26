# One chat for the Desk and Evaluation

Design of the last step of sharing the chat between `apps/desk` and `apps/eval`. Status: approved on
2026-11-26.

## Intent

A tester in Evaluation talks to an agent through the same chat as a person in the Desk. The
product decision is that the two stay identical over time. Today the chat's contracts
(`packages/chat-contracts`) and its logic (`packages/chat`) are shared, and the rest is a copy in
each app that `check:desk-parity` compares: its calls to the API, its components and its texts.
Each change to the chat is made twice, and 23 wanted differences are kept by hand.

This work ends the copy: the chat lives once, in `packages/chat`, and each app gives it what is
its own.

## Goals

- The chat's calls to the API and its components live once, in `packages/chat`.
- Each text only the chat shows is translated once.
- Each app keeps, in its own code, what only it has: for the Desk, the memory, the history, the
  creation, the title and the menu of a conversation; for Evaluation, the forms of a tester's
  session, its feedback panel and the read-only conversation.
- `check:desk-parity` and its baseline disappear: nothing is left to compare.
- A person sees no difference, in either app, in any of the six languages, apart from the one
  change of Evaluation's panels that the product owner chose ("One panel at a time" below).

## Non-goals

- Changing how the chat looks or behaves. A bug found on the way gets its own PR.
- Sharing what is not the chat or what the chat does not use: `main.tsx`, the providers, the query
  keys of other features, the account, invitations and releases features, the test factories and
  the mocked worlds of each app.
- A third consumer (`apps/web`, the embed). The design must not close that door, and does nothing
  for it.
- Sharing the test helpers of the apps. The package gets the few it needs.

## Anti-goals

The work fails, even if every check passes, when:

- `packages/chat` knows an app: a branch on the app's name, an import of the memory, the history
  or the campaigns, a route written by hand.
- A translation is lost or changes, or a text shows in English in a French app.
- The package fills with options that only one app uses and that nothing explains. Each thing an
  app gives the chat is one of four kinds, named below; a fifth kind is a sign to stop and ask.
- A behaviour changes without a spec that shows it.

## What exists today

Read on `main` at `f0fe7e594`.

- Both apps hold `src/features/conversation/`: about 42 components (3,000 lines), 9 hooks, an
  `api/` folder (queries, mutations, the reply stream, the upload of an attachment) and a loader.
  Most files differ only by the contracts package they import.
- Six shared files call the API, through seven functions: the messages of a conversation, the
  HTML of its MCP Apps, whether a cited document is public, sending a message, giving feedback,
  opening a document and opening an attachment.
- The real differences between the two copies:
  - The routes object (`DeskConversationsRoutes` or `EvalConversationsRoutes`) and the API client
    of each app (`lib/api-client.ts`). Both routes objects already have the type
    `ConversationRoutes` of `packages/chat-contracts`.
  - What happens after a reply. The Desk refreshes its history when a form tool runs and when the
    reply ends, and its memories when a memory tool runs. Evaluation calls `onFormsChange`.
  - `ConversationView`. Evaluation's takes `forms`, `headerActions`, `sidePanel` and
    `onSidePanelDismiss` from its owner. The Desk's builds its memory button, memory panel and
    conversation menu itself, and loads its forms with a hook.
  - The Desk shows `MemoryProposals` inside a reply, between its resources and its sources.
  - The panels beside the conversation. In the Desk one state holds the memory, the forms or a
    resource: opening one replaces the other, and closing the memory leaves no panel. In
    Evaluation the owner's panel only hides the chat's panels, which come back when it closes.
    No spec covers that sequence in either app.
  - Three texts and one identifier name the app: two in `ReplyError`, one in `use-dictation`, and
    `HOST_INFO.name` in `use-mcp-app`.
  - Three hooks read the app's settings: `use-mcp-app` reads `appConfig.mcpAppSandboxOrigin`,
    `use-dictation` reads `SPEECH_LANGUAGES` of `app/i18n.ts`, and the loader calls `orNotFound`.
- 33 files of the chat show text through Lingui. 88 messages are common to both apps, with the
  same translation in each of the six languages. Seven more are the Desk's own.
- The chat's components import five compositions of the app that other screens use too:
  `SidePanel` (with `ResizeHandle`), `HeaderActions` (with its context), `CopyButton`,
  `RelativeTime` and `ExternalLink`. Two are identical in both apps. `SidePanel` and `ExternalLink`
  differ by a prop or a storage key. `HeaderActions` differs by the context it reads: an element
  in the Desk (`header-actions-context.ts`), an object with a `back` and an `actions` element in
  Evaluation (`header-slots-context.ts`), which its `HeaderBack` shares.
- The chat also renders with `Markdown`, `InlineCode` and `HighlightedCodeBlock` of
  `components/shared/`, on `hooks/use-highlighted-code.ts` and `lib/highlighter.tsx`. They are
  identical in both apps and under the parity check. The Desk's extraction uses two of them.
- Each app's `global.css` holds the chat's tokens and the rules of its highlights, identical and
  under the parity check.
- The route specs and the stories of each app exercise the whole chat on its mocked API.

## Constraints

- The repository is public: no client, no private repository, no internal URL.
- `npm install` is never run: the lockfile is edited in place.
- The files the conventions gate need a human's go. Approving this design gives it for the edits
  listed in "Governed files" below, and for nothing else.
- Lingui runs with one `i18n` instance per page, and the Vite plugin of an app only compiles a
  `.po` file that a catalog of the app's `lingui.config.ts` matches.
- Each app's Vite plugins compile the source of the packages: the React Compiler and the Lingui
  macro reach `packages/chat` as they reach the app.
- Tailwind only sees the folders a stylesheet names with `@source`.
- A shared package imports no app. `docs/frontend/shared-packages.md` is the one list of the
  shared packages and of their limits, and changes with this work.

## Approaches

Three questions shaped the design. Each was put to the product owner, who chose.

**Where the chat's translations live.**

- In the package (chosen): the chat has its own catalog, translated once, which each app loads
  with its own. It fits "one chat". It needs a second catalog in each app's Lingui configuration.
- In each app: each app extracts the package's texts into its own catalog. Simpler to wire, but
  each new text is translated twice and the two can drift.

**Where the five generic compositions come from.**

- Shared too (chosen): they move to `packages/app-ui`, in a folder apart from the components the
  shadcn CLI generates. Each exists once. It is the larger move, since other screens import them.
- Lent by the app: each app passes its five components to the chat. Smaller, but they stay
  copied with no check, the package's specs need stand-ins, and the chat's contract with the app
  grows by five components.

**What happens to the chat's panel when the app's panel opens.**

- One panel at a time (chosen): opening the app's panel closes the chat's forms or resource
  panel, and closing the app's panel leaves none. It is the Desk's behaviour, and the simplest
  to explain. Evaluation changes: closing its feedback panel no longer brings the forms back.
- The app's panel hides the chat's, which come back: Evaluation's behaviour. The Desk would
  change instead.

**How an app gives the chat what is its own.**

- One object per app, plus a provider (chosen): the app calls `createChat` once. Loaders call the
  object; components read it through a provider.
- A global configuration set at startup: less code, but a hidden dependency that specs must reset.
- Components that take everything as props: no object, but the calls to the API stay copied in
  each app, which is the copy this work ends.

## The design

### 1. Texts: a catalog in each shared package that shows text

`packages/chat` and `packages/app-ui` each get `src/locales/{locale}.po`, for the same six
languages as the apps.

- Each app's `lingui.config.ts` declares three catalogs: its own (`src` to `src/locales`), and
  one per package, whose `include` is the package's `src` and whose `path` is in the package.
  `lingui extract --clean` and `lingui check`, run from either app, then write and check the
  same package catalogs. Each app's `i18n:check` gates them.
- Each app's `activateLocale` imports the three `.po` files of the locale and loads them
  together, the app's last.
- The messages move with their translations. The 88 common messages go to the package catalogs
  with the translation both apps already agree on, and leave the apps' catalogs.
- `src/app/i18n.spec.ts` of each app also fails when a package catalog lacks a language of the
  app.
- A text that names the app is the app's: it stays in the app's catalog, and reaches the chat as
  a Lingui message descriptor (see `texts` below).
- About ten short messages are shown both by the chat and by code that stays in an app ("Cancel",
  "Yes", "No", "Retry", "Copied"). Lingui keys a message by its text, so each stays in every
  catalog whose code shows it, and the catalog loaded last wins. This is accepted. Each app's
  `i18n.spec.ts` fails when a message that two of its catalogs hold has two translations, so the
  copies cannot drift.

The first task of the work is a spike that proves this on one message: a catalog outside the
app's root, extracted, checked, compiled by the Vite plugin in dev, in the tests and in a
production build. If the plugin refuses it, stop and come back with the fallback before anything
else moves: the package compiles its catalogs with `lingui compile` and exports them as modules.

### 2. The generic compositions move to `packages/app-ui`

`CopyButton`, `RelativeTime`, `ExternalLink`, `SidePanel` with `ResizeHandle`, and
`HeaderActions` with its context move to `packages/app-ui/src/compositions/`, with their specs.
The apps and the chat import them as `@caseai-connect/app-ui/compositions/<Name>`.

- `src/components/` stays what the shadcn CLI generates, and nothing else. `src/compositions/`
  holds components written by hand that at least two consumers use and that know no feature.
- What differs between the two copies stays as each app has it today. Whether a `SidePanel` takes
  the focus is a prop, as in Evaluation. The storage key of its width comes from a context of
  `packages/app-ui` that each app's shell provides, so every panel of an app, the chat's
  included, keeps the width the person set, with no setting to pass around.
- `HeaderActions` moves with the Desk's context, one element. Evaluation's shell provides that
  context for its actions, and keeps a context of its own for `HeaderBack`, which only it has.
  This is the one refactor of an app's shell in this work, and belongs to the first PR.
- `packages/app-ui` gains `@caseai-connect/frontend-lib` as a dependency, Lingui as a peer, and
  its catalog. Its stylesheet already names its source folder for Tailwind; `compositions/` joins
  it.

### 3. The chat object

Each app creates one object, in `src/features/conversation/chat.ts`:

```ts
export const chat = createChat({
  routes: { conversation: DeskConversationsRoutes, documents: DeskDocumentsRoutes },
  api: { apiRequest, apiStreamResponse, readServerSentEvents },
  host: { name: "caseai-connect-desk", version: "1.0.0" },
  mcpAppSandboxOrigin: () => appConfig.mcpAppSandboxOrigin,
  speechLanguageOf: (locale) => SPEECH_LANGUAGES[activeLocaleOf(locale)],
  texts: {
    agentUnreachable: msg`The Desk could not reach the agent. Check your connection.`,
    newVersion: msg`A new version of the Desk is available. Reload the page.`,
    microphoneRefused: msg`The Desk may not use your microphone. Allow it in your browser, then try again.`,
  },
  onToolCalled(queryClient, conversation, toolName) { /* history, memories */ },
  onReplySettled(queryClient, conversation) { /* history */ },
})
```

What an app gives the chat is one of four kinds, and nothing else:

1. **Where the API is**: `routes`, typed by `ConversationRoutes` and `DocumentsRoutes` of
   `packages/chat-contracts`, and `api`, the three functions of the app's client that the chat
   calls: a request, a stream, and the reading of its events.
2. **The app's settings**: `host`, `mcpAppSandboxOrigin`, `speechLanguageOf`.
3. **The texts that name the app**: `texts`, as message descriptors of the app's catalog.
4. **What the app does when the chat moves**: `onToolCalled`, each time the stream names a tool,
   and `onReplySettled`, when a reply ends, fails or is stopped, as the stream's last step does
   today. The chat keeps refreshing its own queries
   (the messages, the HTML of the MCP Apps); the callbacks are for the app's queries.

The object gives back what the app's own code needs outside the chat's components: the query
options of the messages (for the app's loader, which keeps its `orNotFound`), `streamReply` (for
the Desk's creation of a conversation, which sends the first message), `stopReplyStream`, and the
query keys the app invalidates.

Components and hooks of the package read the object through `useChat()`, from a `ChatProvider`
the app puts around its chat. A spec gives a provider the object it needs.

`packages/chat` takes the types of the client's three functions from
`@caseai-connect/api-client`, as a type-only import, and calls the functions the app gives it:
it has no runtime dependency on the client or on the sign-in. With the components, it gains
`@caseai-connect/app-ui`, TanStack Query and Lingui as peers, and the libraries its files already
import in the apps: Tiptap, streamdown, shiki, react-hook-form, sonner, lucide-react and `cn`.
All of them go in its row of the list.

### 4. The components

Every file of `features/conversation` that both apps have moves to `packages/chat`, with its
spec, along with `Markdown`, `InlineCode`, `HighlightedCodeBlock`, `use-highlighted-code` and
`highlighter`. The package exports the pieces the apps compose with: the Desk's new conversation
uses the message box, Evaluation's read-only conversation and reviewer transcript use the message
view and the list of sources, and the Desk's extraction uses the Markdown and the code block.

`ConversationView` takes the shape of Evaluation's, which already receives what its owner has:

| Prop | The Desk passes | Evaluation passes |
|---|---|---|
| `forms` | the forms its history hook loads | the forms of the tester's session |
| `headerStart`, `headerEnd` | its memory button, its conversation menu | the action that ends the session |
| `sidePanel`, `onSidePanelDismiss` | its memory panel, whose open state it now holds | its feedback panel |
| `renderReplyExtras` | the memory proposals of a reply, from its tool results | nothing |

The Desk's `use-conversation-panel` loses its `memory` case: the chat's panel state knows the
forms and a resource only, as Evaluation's does today.

**One panel at a time.** The app's panel and the chat's panels never show together, and neither
comes back by itself. When the chat opens one of its panels, it calls `onSidePanelDismiss` and
the app closes its own, as today. When the app opens its panel, the chat closes its own: the
forms or the resource do not come back when the app's panel closes. This keeps the Desk as it
is and changes Evaluation, on purpose. A spec of the package covers both directions, and each
app's route specs gain the sequence with its own panel (the memory, the feedback).

The chat's tokens and the rules of its highlights leave each app's `global.css` for a stylesheet
of the package, which each app imports after `app-ui`'s. The package's stylesheet names its
source folder for Tailwind, and the `@source` of streamdown moves with the Markdown.

What stays in each app's `features/conversation`: `chat.ts`, its loader, its `index.ts`, and its
own components and hooks (the Desk: `NewConversation`, `ConversationTitle`, `ConversationMenu`,
`use-conversation-title`, `use-conversation-forms`, the mutation that starts a conversation;
Evaluation: `ReadOnlyConversation`).

### 5. Tests

- The route specs and the stories of both apps do not change, apart from imports. They are the
  net of this work: they exercise the whole chat through each app, and must pass unchanged after
  each step. A route spec that needs a change other than an import is a behaviour change: stop.
- The specs of the moved files move with them. `packages/chat` gets the small test kit they need
  (a render with Lingui and a query client, the helper that writes in the message box, an MSW
  server with a typed route mock) and a Vitest configuration with the Lingui macro. A spec that
  needs a compiled catalog, such as the French one of the message box, stays in each app.
- The reply stream gets specs of its own in the package, on a mocked stream: the events in
  order, a stream that closes early, a broken event, an upload that fails, a stop by the person,
  and each callback called once at the right moment. Today only the apps' route specs cover it.
- `chat-parity.spec.tsx` and its snapshot move to the package as one rendering spec of a
  conversation, or go if the moved specs cover it.

### 6. The end of the parity check

Once nothing is copied: delete `apps/eval/scripts/check-desk-parity.mjs`, its baseline, the
`check:desk-parity` script, its CI step, the Desk's chat paths in Evaluation's CI filter, and
every mention in the docs.

## Delivery

Three PRs, each merged before the next starts. After each one, both apps build, their `check`
passes and their route specs are unchanged.

1. **Texts in a package, and the compositions.** The spike, the catalog mechanism, then the five
   compositions in `packages/app-ui` with their catalog. It proves the mechanism on a small
   surface and does not touch the chat's behaviour.
2. **The chat object and the calls to the API.** `createChat`, the provider, the queries, the
   mutations, the reply stream and the hooks that call the API move to the package, with the
   stream's specs. The components stay in the apps and read the object.
3. **The components.** The components, the Markdown, the chat's catalog and its stylesheet move;
   `ConversationView` takes its slots; the parity check goes. Before the merge, a person checks
   by hand, in both apps and in French and English: sending a message and watching it stream, an
   attachment, a quoted passage and an annotation, the sources of a reply, a resource in its
   panel, the forms panel, an MCP App card, the dictation button, a thumbs-up and a report, and a
   change of language. In the Desk: the memory proposals and the memory panel. In Evaluation: a
   tester's session with its feedback panel, and the read-only transcript.

## Governed files

Approving this design gives the go for these edits, in the PR that needs each:

- `lingui.config.ts` of both apps (the package catalogs).
- `.dependency-cruiser.cjs` of both apps (the comment of the allowlist, if a package name
  changes there).
- The Vitest configuration of `packages/chat` and of `packages/app-ui`.
- `docs/frontend/shared-packages.md`: the rows and limits of `chat` and `app-ui` (a shared
  package may show text when it has a catalog; `app-ui` holds compositions; the new
  dependencies), and the steps for a package with a catalog.
- `docs/frontend/conventions.md`, both `AGENTS.md`, ADR 0031 (one amendment per PR) and the root
  `CLAUDE.md`, where they describe what moved.
- `.github/workflows/ci.yml` and `apps/api/Dockerfile`, as the list's last section asks.

## Left to the builder

These are calls a builder can make without changing what gets built. Where a default is given, it
is the author's call, not a decision of the product owner.

- The names of the props and of the functions above.
- Whether `renderReplyExtras` is a prop of `ConversationView` or a part of the provider.
- Whether Evaluation keeps `onFormsChange` as a prop or moves it to `onToolCalled`. Default: the
  callback of the chat object, if Evaluation's forms are a query it can invalidate.
- Where `lib/field-text.ts` goes, which the forms panel and the Desk's extraction both use and
  which shows two texts. Default: `packages/chat`, exported.
- The order of the moves inside each PR.

## Risks

- **The reply stream is shared for real.** A mistake reaches both apps at once. Its new specs and
  the unchanged route specs are the guard, with the check by hand before the last merge.
- **Two apps can now break a catalog for each other.** Each app's `i18n:check` covers the package
  catalogs, so the PR that breaks one fails in both jobs.
- **The object could grow.** The four kinds above are the limit. A need outside them comes back to
  the product owner.
- **The last PR is large.** It moves about 50 files and rewires two apps. It moves code without
  changing it, and the route specs do not change, which keeps the review to the seams: the
  provider, the slots and the catalogs.
