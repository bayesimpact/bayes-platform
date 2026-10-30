# Desk: sidebar and chat shell

Status: draft, for the Desk's home PR (bayesimpact/bayes-platform#1069, branch `feat/desk-home`).

## Intent

The Desk is where end users talk to the agents of their projects. It should feel like the Claude
app: a sidebar on the left with the history of past sessions, and in the center the current
session, with the input at the bottom.

Most people have one project and one agent. Some have several agents in a project, and a few have
several projects, each with several agents. The screen is designed for the first case and stays
quiet about the others: someone with a single agent never sees a selector.

This change builds the shell: the layout, the sidebar, the agent switcher and the history, on the
real API. The chat itself (sending a message, streaming the answer, opening a past conversation)
and the extraction screen (dropping a document) come in the next changes.

## Goals

- A two-pane layout like the Claude app: sidebar on the left, session area in the center.
- The sidebar shows, from top to bottom: the agent switcher (or the logo when there is nothing to
  switch), a "New conversation" button, the history of the selected agent grouped by date, and the
  user menu at the bottom.
- One switcher for project and agent, in a single menu at the top of the sidebar (option A of the
  mockups). Its trigger shows the project's name small and the agent's name below it. The menu
  lists the agents grouped by project.
- The switcher only appears when the person has more than one agent. With one project and several
  agents, the menu lists the agents with no project heading, and the trigger shows no project name.
- Projects and agents come from the API. Choosing an agent changes the history in the sidebar and
  opens a new session with that agent.
- Both agent types appear: conversation agents and extraction agents.
  - A conversation agent's history lists its conversations.
  - An extraction agent's history lists its extractions.
- The history comes from the API too.
- Landing on the Desk opens a new session with the default agent: the center shows the empty state
  of a new conversation, with the input at the bottom, ready to type.

## Non-goals

- Sending a message, streaming, creating a session. The input is shown but does not send yet.
- Opening a past conversation or extraction: an entry of the history opens its own URL, whose
  center says it is coming.
- Uploading a document to an extraction agent.
- Renaming, deleting or searching sessions.
- Any change to `apps/api` or `packages/api-contracts`.
- Storybook (excluded by ADR 0031; the mock mode covers the need).

## Anti-goals

- A person with one agent sees a project or agent selector, or has to pick anything before typing.
- The home page's list of projects survives as a step before the chat.
- Code imported, copied or imitated from `apps/web`'s Desk.

## Constraints

- Every rule of `docs/frontend/conventions.md` and `apps/desk/AGENTS.md`: TanStack Router and
  Query, loaders with `useSuspenseQuery`, skeletons, error states with retry, empty states, Lingui
  with French translations, MSW handlers and factories, `npm run check -w @caseai-connect/desk`.
- No new dependency without a human's go. shadcn components are generated with its CLI.
- Endpoints as they are today:

| Need | Route | Notes |
|---|---|---|
| Projects | `GET projects/mine` | already in `desk-contracts`; keep the projects that grant `desk.ui.read` |
| Organizations | `GET organizations/mine` | already in `desk-contracts` |
| Agents of a project | `GET organizations/:organizationId/projects/:projectId/agents` | needs `project.read`; returns the agents the person is a member of, published at least once, sorted by name; both `conversation` and `extraction` types; fields `id`, `name`, `type`, `projectId`, `createdAt`, `currentRevision` |
| Conversation history | `POST organizations/:organizationId/projects/:projectId/agents/:agentId/conversation-agent-sessions/live` | the caller's own live conversations, newest first, no pagination; fields `id`, `title` (optional), `createdAt`, `updatedAt` |
| Extraction history | `POST organizations/:organizationId/projects/:projectId/agents/:agentId/extraction-agent-sessions/live` | the caller's live extractions; fields `id`, `documentFileName` (nullable), `status` (`pending`, `success`, `failed`), `createdAt`, `updatedAt` |

  Each route the Desk reads is declared in `packages/desk-contracts` with the schemas of the fields
  it reads, as the conventions ask.

## Decided by Alexis

- The layout of the Claude app, with the history in the sidebar and the session in the center.
- Option A: one menu for project and agent, at the top of the sidebar.
- No selector in the main case (one project, one agent): the person lands on a new conversation.
- Projects and agents are wired to the API in this change. The chat stays a shell.
- Extraction agents are in the switcher, and their history (past extractions) shows in the sidebar.

## Builder's calls, made by Claude

- **Pending invitations and terms** (ADR 0031 §2.9) wait for the next change. `/app` opens the
  default agent until then.
- **CSV extractions** show in an extraction agent's history, mixed with document extractions and
  sorted newest first, as in today's Desk (`GET .../csv-extraction-runs/live`).
- **`apps/desk/AGENTS.md` and ADR 0031** are not edited in this change: both need a human's go.

- **URLs.** ADR 0031 §2.6 keeps today's URLs, so bookmarks and links from Studio keep working. The
  agent is in the path, so a link or a reload keeps it. Under `/app/o/$organizationId/p/$projectId`:
  - the project URL itself redirects to that project's default agent;
  - `/a/$agentId` is a new conversation with a conversation agent;
  - `/a/$agentId/as/$agentSessionId` is a past conversation;
  - `/a/$agentId/extraction` is a new extraction with an extraction agent (and `/a/$agentId` of an
    extraction agent redirects there);
  - `/a/$agentId/extraction/runs/$extractionRunId` and
    `/a/$agentId/extraction/csv-runs/$csvRunId` are past extractions.

  The past-session URLs are placeholders in this change. `/app/` redirects to the default agent,
  and the existing `/app/o/$organizationId/` redirect to `/` stays.
- **Default agent.** The last agent the person opened on this device, kept in `localStorage`, when
  it is still in their list. Otherwise the first agent of the first project, in the order the menu
  shows them (projects sorted as `listDeskProjects` does, agents by name).
- **An agent the person cannot reach** (bad or stale URL): the not-found state, with a link back to
  `/app/`.
- **Nobody to talk to.** When the person has no desk project or no agent, the center shows an empty
  state ("You don't have access to an agent yet") and the sidebar shows only the logo and the user
  menu.
- **History grouping.** Today, Yesterday, Previous 7 days, Previous 30 days, then Older, by
  `createdAt` in the person's time zone.
- **History labels.**
  - A conversation with no title shows "New conversation".
  - An extraction shows its file name, or "Untitled document" when it has none. A small status mark
    shows pending and failed extractions.
- **Empty history.** A short line under "New conversation" ("No conversations yet" or "No
  extractions yet").
- **New session button.** "New conversation" for a conversation agent, "New extraction" for an
  extraction agent. It goes to the agent's new-session URL.
- **Center of a new session.**
  - A conversation agent shows a greeting with the agent's name and the input box. The input box
    is disabled, with a hint that sending comes next.
  - An extraction agent shows a drop zone, disabled the same way.
- **Agent types in the menu.** A small icon tells conversation and extraction agents apart.
- **The header bar goes.** The current `AppHeader` and the home page (`features/home`) are replaced
  by the sidebar layout: the logo moves to the top of the sidebar, and the user menu to its bottom.
  `listDeskProjects` and its tests move to the feature that now owns projects.
- **Phone width.** The sidebar collapses behind a button at the top left, and opens over the page.
- **Data loading.**
  - The layout's loader loads projects, organizations and the agents of every desk project in
    parallel, so the switcher and the redirect have everything they need.
  - The history loads in the sidebar with its own skeleton, so it never blocks the center.
- **Mock mode scenarios.**
  - The default world has one project and one conversation agent with a few conversations.
  - Scenarios add several agents, several projects, an extraction agent, an empty history, no agent
    at all, an error and a slow load.
  - Sample data stays neutral ("Helpful Assistant", projects "Pricing", "Support", "Help center").

## Left to the builder

- The split into features (for example `agents`, `sessions`, `layout`) and components, within the
  conventions' boundaries.
- Which shadcn components to generate (the `sidebar` block or a simpler composition), as long as
  no new dependency comes in without a human's go.
- The query keys and the exact loader composition.
- The test list, within the conventions: each new route and component gets its spec, and the
  switcher's hiding rules and the default-agent choice are tested.
