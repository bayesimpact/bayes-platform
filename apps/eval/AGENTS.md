# AGENTS.md (apps/eval)

Evaluation: where project members evaluate their agents (datasets, runs), manage review
campaigns, and where the testers and reviewers of a campaign take part in it. It follows the shared rules of
[docs/frontend/conventions.md](../../docs/frontend/conventions.md), and
[ADR 0031](../../docs/adr/0031-frontend-stack-for-agent-built-apps.md) keeps the reasons. This
file holds what is specific to Evaluation. It uses the same library versions as the Desk.

## Evaluation at a glance

- Served under `/eval/` (Vite's `base`, `appBasePath` in `src/app/config.ts`, the router's
  `basepath`), the path of the evaluation pages of apps/web, which this app replaces.
- Contracts: `@caseai-connect/eval-contracts` (`packages/eval-contracts`), one folder per area,
  with an `Eval{Area}Routes` object per area. It describes the API routes the app calls and the
  fields it reads; the API does not import it.
- Sign-in: `src/lib/auth/`, the only code that knows `oidc-client-ts`, used through
  `lib/auth/session.ts`. It comes back to `<origin>/eval/auth/callback` (`<origin>/eval/` after
  sign-out). It shares one session with every app of the origin (apps/web, the Desk): the user
  under `oidc.user:<authority>:<client>`, refreshed under the Web Lock `oidc-token-refresh`, and a
  sign-out or an account switch in another app ends this app's session too. Only the state of a
  sign-in it started stays its own, under `eval.oidc.`.
- The layout of every signed-in page (`src/routes/_authenticated.tsx`) waits for `GET me`
  (`features/account`), so a sign-in the API refuses shows before any page.
- Access: the app opens to a person it holds something for (`EvaluationAccessGate` in
  `features/agents`, `NoEvaluationAccessPage` for anyone else). It checks permissions, never a
  role's name (ADR 0019):
  - `evaluation.ui.read` on a project, from the `project_evaluator` role: its agents show.
  - `project.review_campaign.read` on a project, held by its owners and admins: its agents show,
    with their review campaigns. Creating, updating, deleting, inviting and revoking each check
    their own `project.review_campaign.*` permission, and the report `review_campaign.report.read`.
  - a tester or reviewer role in a review campaign (`GET me/review-campaigns`, once per role):
    that campaign shows, and nothing else. A campaign page checks the role it needs.
  The API checks every route on its own.
- Configuration: the API will inject `window.__CONFIG__` when it serves the app; in dev, the
  `VITE_*` values of `apps/eval/.env` stand in (see `.env-example`).

- New releases: each production build gets an id, which it knows (`buildId` in
  `src/app/config.ts`) and publishes in `version.json` beside its files (`publishBuildId` in
  `vite.config.ts`). The API only serves that file with `Cache-Control: no-cache`, so no cache on
  the way keeps it. The root route polls that file every minute while the
  tab is visible (`features/releases`) and hands its id to `appUpdate` (`src/lib/app-update.ts`).
  Another build counts as new once it alone was published for a minute, so a rolling deployment
  does not announce the old build, and at once when Vite cannot load a chunk of this tab's build
  (`vite:preloadError`). Then `NewReleaseBanner`, below the bar of every signed-in page (`AppShell`), offers the
  reload, which the person chooses; `useReloadWhenSafe`, in the root route, turns the next move to
  another page into a full load of that page, unless a mutation is on its way; and
  `RouteErrorState` offers a reload, not a retry. The app never reloads the page the person is on
  by itself. Dev, the tests and Storybook have no build id, and poll nothing.
## Commands

Run them from the repository root.

| Command | What it does |
|---|---|
| `npm run dev -w @caseai-connect/eval` | Dev server on port 5179 at `/eval/`, forwarding `/api` to the local API |
| `npm run storybook -w @caseai-connect/eval` | Storybook on port 6010: the whole app on the MSW handlers, with no API and no sign-in |
| `npm run check -w @caseai-connect/eval` | Typecheck, Biome, dependency-cruiser, knip, translation checks and Vitest |
| `npm run test -w @caseai-connect/eval` | Vitest alone |
| `npm run i18n:extract -w @caseai-connect/eval` | Writes every message to `src/locales/en.po` and `fr.po` |
| `npm run build -w @caseai-connect/eval` | The production build, in `apps/eval/dist` |
| `npm run preview -w @caseai-connect/eval` | Serves that build on port 5180 at `/eval/` |

In a worktree with an environment, never start `dev` or Storybook on the host: the `eval` and
`storybook-eval` services of `infra/worktree/docker-compose.yaml` run them, at `<WT_ORIGIN>/eval/`
and `http://<name>-eval-storybook.connect.localhost:8800`.

## Where things are

- The frame: the Desk's, without the sessions. `AppShell`
  (`components/shared/`) holds the sidebar: the current agent at the top, which opens the command center (`AgentSidebarHeader` in
  `features/agents`), the person's menu at the bottom (`CurrentUserMenu` in `features/account`, the
  Desk's without the name edit), with the envelope of their pending invitations beside it
  (`InvitationsButton` in `features/invitations`, the Desk's, on `GET me/invitations` every
  minute). An accepted invitation loads the workspace again, so a campaign joins the person's.
  Once hidden, the sidebar peeks over the page, below the bar, while the pointer rests on its
  button or on it (`useSidebarPeek` in `hooks/`), as in Claude Desktop; a click pins it.
- The workspace: `features/agents` reads `GET projects/mine`, `GET organizations/mine` and
  `GET me/review-campaigns` for both roles, keeps the projects the app opens, then reads each
  one's `GET .../agents-with-drafts`, drafts included since evaluation runs them, under one query
  (`evaluationWorkspaceQueryOptions`).
- The app is the door to several features, and a person may hold one of them or several: the
  evaluations of a conversation agent or of an extraction agent (who evaluates the project), the
  review campaigns of a conversation agent (who manages them), and a campaign to test or to
  review (who was invited). An agent's features are its sections
  (`src/routes/-components/agent-sections.ts`): `evaluations` and `campaigns`, each kept when the
  person holds it. An agent with one section opens on it; with several, its first page is the hub
  (`AgentHubPage`), one card per section, and the sidebar links back to it (Overview). A new
  feature of an agent is a new section there.
- `AgentSectionsNav` is the sidebar of an agent's pages: Overview, Evaluations, then the
  Campaigns menu (`CampaignsMenu` in `src/routes/-components/`), which folds
  (`SidebarCollapsibleMenu` in `components/shared/`) and starts open. It shows when it holds
  something:
  - for who manages the agent's campaigns (`CampaignsSidebarEntries` in `features/campaigns`):
    List all, the table of the agent's campaigns, a new campaign, then the campaigns under Active,
    Draft and Closed. It reads its query inside `SidebarSection` (`components/shared/`), so it
    never holds the page back;
  - then two sub-menus that fold (`SidebarCollapsibleSubMenu`, `ParticipantSidebarMenus.tsx`):
    Reviewer and Tester, the campaigns on this agent the person reviews, or tests, under Active
    then Closed, each a link to that side of the campaign. The campaign whose page shows lists
    its sessions under it, on the side its page shows (`ReviewerSessionLinks` in
    `features/campaign-review`, those to review first; `TesterSessionLinks` in
    `features/campaign-test`), each by a short date with where it stands. A sub-menu with no campaign does not show. Each campaign of
    `GET me/review-campaigns` names its agent. Only the sub-menu that holds the current page opens
    at first, and both on a page neither holds (`useOpenSidebarMenu` in `src/routes/-components/`).
- A campaign's pages for its participants keep the sidebar of its agent, as on the agent's own
  pages, where the campaign shows in the Reviewer or Tester sub-menu of Campaigns. A person who
  only takes part holds no agent: their sidebar names the agent (`CampaignSidebarHeader` in
  `features/campaign-context`) above a Campaigns menu with those sub-menus alone. The campaign's own pages are tabs, each at
  its own URL (`ParticipantCampaignFrame` in `features/campaign-context`): below the agent's card:
  Sessions and Report for a reviewer, under `review/`; Sessions and Final survey for a tester,
  under `test/`. A tester's Sessions starts a session and lists theirs; a reviewer's lists the
  sessions to review.
- The top bar of the page holds its way back and its actions: `PageHeader`'s `back` and `actions`
  go there (`HeaderBack`, `HeaderActions`), so they stay in view as the page scrolls, and the
  title stays in the page. At phone width, the back link keeps its arrow only and the actions go
  in a menu (`HeaderActionsMenu`). A link styled as a button takes `cn(buttonVariants(...))`:
  without `cn`, the variant's border loses to the base's `border-transparent`.
- A page in two parts is a `SplitPage` (`components/shared/`): the page on the left, a `SidePanel`
  on the right, each scrolling alone, with a `SidePanelToggle` in the bar above the page.
  `useSidePanel` shows the panel from the start where the window has room for it. Three pages use
  it: a campaign's setup with the preview of its forms (the `preview` search param), a session
  with the reviewer's review, and a tester's conversation with the feedback that ends it
  (`ConversationView`'s `sidePanel`). The blocks of a panel are `PanelSection`s.
- The command center that switches agent (`AgentCommandCenterProvider` in `features/agents`,
  around every signed-in page): ⌘K, or Ctrl+K outside Apple systems, the button at the top of an
  agent's sidebar and the app's home open it. It lists every agent by project,
  with a search on the names of the agents, projects and organizations. A person with a single
  agent gets none. It is shadcn's `Command` (`components/ui/command.tsx`) on `cmdk`, a library a
  human chose for it: `cmdk` brings a few Radix primitives of its own, which the app's code does
  not import.
- The home: `src/routes/_authenticated/index.tsx`, with no page of its own while the person has
  an agent. It opens the agent used last, else the first one, and with several adds
  `switchAgent` to the URL (`agentSearchSchema` in `features/agents`), which opens the command
  center over the agent. A project's URL, where the Studio's app menu leads, does the same with
  the project's default agent. With no agent, it opens the person's first campaign, and says so when
  there is nothing.
- An agent's pages: `src/routes/_authenticated/o/$organizationId/p/$projectId/a/$agentId/`, whose
  `route.tsx` is the frame and `index.tsx` the hub, or the way to the agent's only section.
  `evaluations/` holds its datasets and, later, its runs, for who evaluates the agent
  (`requireEvaluationAgent` in `features/agents`).
- The evaluations of a conversation agent (`features/conversation-datasets`), on the API's
  `evaluation-conversation-datasets` routes (`EvalConversationDatasetsRoutes`): `evaluations/`
  lists the datasets of the agent's project, which every conversation agent of the project shares,
  and `evaluations/$datasetId` shows one with its records, a page at a time (the `page` search
  param, counted from 0, on the shared `TablePagination`). Creating, renaming and deleting a
  dataset each check their own `evaluation.conversation.dataset.*` permission; a record is added,
  changed and deleted with the update one, as the API does. A row's actions are Open grouped with
  a « ⋯ » menu (`DatasetRowActions`); a record's and the dataset page's are a « ⋯ » menu alone.
  Records are added one at a time (`RecordDialog`) or pasted, one per line, the input then the
  expected output after the first comma (`BulkRecordsDialog`, `parseBulkRecords`). A record's
  comment comes from the Studio's "Save as test case" and is only read here. In the sidebar,
  Evaluations is then a menu that folds, as Campaigns: List all, then the datasets
  (`ConversationDatasetsSidebarEntries`). Of Evaluations and Campaigns, only the menu that holds
  the current page opens at first, and both on a page neither holds (`useOpenSidebarTopMenu` in
  `src/routes/-components/`). An extraction agent's evaluations are not here yet: its
  page says so, and its sidebar keeps a plain link.
- Review campaigns, for who manages them (`features/campaigns`), under an agent's
  `review-campaigns/`: the list, `new`, the editor `$reviewCampaignId` (its tab in the `tab` search
  param: setup, participants, summary) and its `report`. The report is a tab too, at its own URL:
  both pages share the campaign's header and tabs (`CampaignPageFrame`), and the report's page
  shows `CampaignReportContent` of `features/campaign-report`. What acts on the open tab sits on
  the right of the tabs (`tabActions`): the setup's Preview, the report's Download CSV. A campaign reviews one
  conversation agent. Only a draft's setup changes; `CampaignStatusActions` activates, closes or
  deletes after a confirmation. A draft's Activate is the page's primary action, grouped with a
  « ⋯ » menu (More actions) that holds Delete.
- A draft its manager can change is set up step by step (`CampaignPage` picks it, then
  `CampaignSetupWizard`), its step in the `step` search param (`SETUP_STEPS`): Campaign, After
  each session, Final survey, Session review, Activate, then Invite once active. `new` is the
  first step, whose Next creates the draft with the default questions. Each Next checks its step's
  fields (`SETUP_STEP_FIELDS` in `setup-steps.ts`) and saves what changed, and so do Back and the
  stepper; Activate saves first too. What changed is the form against the campaign as saved, not
  the form's dirty state, which a read of the campaign in the background resets. Leaving the page
  with changes not saved asks first (`UnsavedChangesGuard`). `SetupStepper` reopens a
  step done; below a wide window, only the current step keeps its name, and a tooltip names the
  others. In the setup, the bar's Activate gives way to the Activate step, and the preview opens
  only the step's form. The three forms have one name each, everywhere: After each session, Final
  survey, Session review, the names their testers and reviewers see.
- Any other campaign shows in tabs (`CampaignEditor`): its Setup tab reads as the campaign's forms
  (`CampaignSetupView`), its General card then one sub-tab per form, as the report does. A form's
  fields are `FeedbackFormFields`, which the setup's preview panel folds in `FeedbackFormPreview`
  (on the shared `FoldingCard`).
- A campaign for its participants, under
  `src/routes/_authenticated/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/`:
  `route.tsx` is the frame and loads the campaign (`features/campaign-context`), `test/` is the
  tester's side (`features/campaign-test`: sessions, feedback, final survey, and the conversation
  in `test/sessions/$sessionId`), `review/` the reviewer's (`features/campaign-review`: sessions,
  a session blind then whole, the review). `features/campaign-report` is the report both the
  managers and the reviewers read; its CSV is built in the browser from the report. Below its headline figures, one sub-tab per form
  shows how the answers spread, and a last one the sessions.
- The conversation of a tester's session: `features/conversation`, the Desk's chat on the
  `review_campaign_tester` session routes, without the memory (the API gives a test session
  none) and the history. It stays the Desk's: `npm run check:desk-parity` compares it, and the
  Markdown it renders with, with the Desk's, and fails on any difference not recorded in
  `scripts/desk-parity.json` (record a wanted one with `-- --update`). `chat-parity.spec.tsx`,
  in both apps, renders one conversation to a snapshot that check compares too. The reviewer's
  transcript shows each reply's sources with the same `SourcesList`. Its
  owner gives it the session's forms and loads them again when the agent fills one in.
- MCP Apps: a card runs in the sandbox of `@caseai-connect/mcp-app-host`
  (`packages/mcp-app-host`), the one package the app shares with the Desk, `apps/web` and
  `apps/web-embed` (ADR 0031, section 2.4). The chat keeps what is its own, as the Desk does: the
  `useMcpApp` hook and `McpAppCard` in `features/conversation`, and the lookup of an app's HTML.
- A rating, a comment and the answers to a campaign's questions go through one form,
  `components/shared/RatedFeedbackForm.tsx` (`lib/rated-feedback.ts`), for the tester's feedback
  and survey and the reviewer's review. The API checks the rating only: the form holds the
  required answers.
- The API client: `src/lib/api-client.ts`. The query client's retry rules:
  `src/app/query-client.ts`.
- The mocked API: `src/test/msw/handlers.ts`, `campaign-handlers.ts` and
  `conversation-dataset-handlers.ts`, written with `mockRoute`
  and `mockStreamRoute` (`src/test/msw/mock-route.ts`) and fed by the factories of
  `src/test/factories/`, whose `eval-world.factory.ts` builds the worlds: the owner of a project
  with campaigns who evaluates it too (the main one), an owner who does not, a person who holds
  everything at once, a participant who only tests and reviews, and the edge cases.
  Its URLs come from `src/test/eval-urls.ts`.
- The stories, in five folders of Storybook under `Evaluation`: `General`
  (`src/stories/Eval.stories.tsx`), `Conversation evaluations`
  (`ConversationEvaluations.stories.tsx`), `Review campaigns` (`Campaigns.stories.tsx`), `Reviewer`
  (`Reviewer.stories.tsx`) and `Tester` (`Tester.stories.tsx`), with the meta of
  `src/stories/eval-meta.tsx`. `src/stories/Eval.stories.spec.tsx` renders every story in the
  tests.
