# AGENTS.md (apps/eval)

Evaluation: where project members evaluate their agents (datasets, runs), manage review
campaigns, and where the testers and reviewers of a campaign take part in it. It follows the shared rules of
[docs/frontend/conventions.md](../../docs/frontend/conventions.md), and
[ADR 0031](../../docs/adr/0031-frontend-stack-for-agent-built-apps.md) keeps the reasons. This
file holds what is specific to Evaluation. It uses the same library versions as the Desk.

## Evaluation at a glance

- Served under `/eval/` (Vite's `base`, `appBasePath` in `src/app/config.ts`, the router's
  `basepath`), the path of the evaluation pages of apps/web, which this app replaces.
- Contracts: `@bayes-platform/eval-contracts` (`packages/eval-contracts`), one folder per area,
  with an `Eval{Area}Routes` object per area. It describes the API routes the app calls and the
  fields it reads. The API requires its CommonJS build and serves every route under `eval/`, in
  `apps/api/src/domains/eval/`, with the same schemas. The app calls only `eval/` endpoints,
  with one exception: a resource card links to a library file at
  `organizations/.../resource-libraries/.../resources/.../file` (`src/lib/safe-url.ts`), outside
  `eval/` and the contracts, until an Evaluation route serves it.
- Sign-in: `src/lib/auth/`, the only code that knows `oidc-client-ts`, used through
  `lib/auth/session.ts`. It comes back to `<origin>/eval/auth/callback` (`<origin>/eval/` after
  sign-out). It shares one session with every app of the origin (apps/web, the Desk): the user
  under `oidc.user:<authority>:<client>`, refreshed under the Web Lock `oidc-token-refresh`, and a
  sign-out or an account switch in another app ends this app's session too. Only the state of a
  sign-in it started stays its own, under `eval.oidc.`.
- The layout of every signed-in page (`src/routes/_authenticated.tsx`) waits for `GET eval/me`
  (`features/account`), so a sign-in the API refuses shows before any page.
- Access: the app opens to a person it holds something for (`EvaluationAccessGate` in
  `features/agents`, `NoEvaluationAccessPage` for anyone else). It checks permissions, never a
  role's name (ADR 0019):
  - `evaluation.ui.read` on a project, from the `project_evaluator` role: its agents show.
  - `project.review_campaign.read` on a project, held by its owners and admins: its agents show,
    with their review campaigns. Creating, updating, deleting, inviting and revoking each check
    their own `project.review_campaign.*` permission, and the report `review_campaign.report.read`.
  - a tester or reviewer role in a review campaign (`GET eval/me/review-campaigns`, once per role):
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
| `npm run dev -w @bayes-platform/eval` | Dev server on port 5179 at `/eval/`, forwarding `/api` to the local API |
| `npm run storybook -w @bayes-platform/eval` | Storybook on port 6010: the whole app on the MSW handlers, with no API and no sign-in |
| `npm run check -w @bayes-platform/eval` | Typecheck, Biome, dependency-cruiser, knip, translation checks and Vitest |
| `npm run test -w @bayes-platform/eval` | Vitest alone |
| `npm run i18n:extract -w @bayes-platform/eval` | Writes every message to `src/locales/en.po` and `fr.po` |
| `npm run build -w @bayes-platform/eval` | The production build, in `apps/eval/dist` |
| `npm run preview -w @bayes-platform/eval` | Serves that build on port 5180 at `/eval/` |

In a worktree with an environment, never start `dev` or Storybook on the host: the `eval` and
`storybook-eval` services of `infra/worktree/docker-compose.yaml` run them, at `<WT_ORIGIN>/eval/`
and `http://<name>-eval-storybook.connect.localhost:8800`.

## In production

The `app-runtime` image builds the app (the `eval-build` stage of `apps/api/Dockerfile`) and the
API serves it at `/eval`, ahead of `apps/web` (`EVAL_APP_DIST_DIR`, `registerWebApp` in
`apps/api/src/common/web-app`), with the same injected configuration as `apps/web` and the
install's theme mounted over `dist/theme` (`web.evalDistDir` in the Helm chart). Each install
registers `<origin>/eval/auth/callback` and `<origin>/eval/` with its identity provider.

## Where things are

- The frame: the Desk's, without the sessions. `AppShell`
  (`components/shared/`) holds the sidebar: the current agent at the top, which opens the command center (`AgentSidebarHeader` in
  `features/agents`), the person's menu at the bottom (`CurrentUserMenu` in `features/account`, the
  Desk's without the name edit), with the envelope of their pending invitations beside it
  (`InvitationsButton` in `features/invitations`, the Desk's, on `GET eval/me/invitations` every
  minute). An accepted invitation loads the workspace again, so a campaign joins the person's.
  Once hidden, the sidebar peeks over the page, below the bar, while the pointer rests on its
  button or on it (`useSidebarPeek` in `hooks/`), as in Claude Desktop; a click pins it.
- The workspace: `features/agents` reads `GET eval/projects/mine`, `GET eval/organizations/mine` and
  `GET eval/me/review-campaigns` for both roles, keeps the projects the app opens, then reads each
  one's `GET eval/.../agents`, the agents with a version in production, since an evaluation and a
  campaign run a saved version and never a draft, under one query
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
    `GET eval/me/review-campaigns` names its agent. Only the sub-menu that holds the current page opens
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
  `useSidePanel` shows the panel from the start where the window has room for it. Four pages use
  it: a run of an evaluation with what it used, a campaign's setup with the preview of its forms (the `preview` search param), a session
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
  `evaluations/` holds its datasets and their runs, for who evaluates the agent
  (`requireEvaluationAgent` in `features/agents`).
- The evaluations of a conversation agent (`features/conversation-datasets`), on the API's
  `evaluation-conversation-datasets` routes (`EvalConversationDatasetsRoutes`): `evaluations/`
  lists the datasets of the agent's project, which every conversation agent of the project shares,
  and `evaluations/$datasetId` shows one with all its records: the API pages them, 100 at most,
  and the app reads every page (`conversationDatasetRecordsQueryOptions`). Creating, renaming and deleting a
  dataset each check their own `evaluation.conversation.dataset.*` permission; a record is added,
  changed and deleted with the update one, as the API does. A row's actions are Open grouped with
  a « ⋯ » menu (`DatasetRowActions`); a record's and the dataset page's are a « ⋯ » menu alone.
  Records are added one at a time (`RecordDialog`) or pasted, one per line, the input then the
  expected output after the first comma (`BulkRecordsDialog`, `parseBulkRecords`). A record's
  comment comes from the Studio's "Save as test case" and is only read here. In the sidebar,
  Evaluations is then a menu that folds, as Campaigns: List all, New dataset, which opens the
  list with its dialog (the `create` search param), then the datasets
  (`ConversationDatasetsSidebarEntries`). A dataset's page has two tabs, Records and Runs (the
  `tab` search param). The dataset whose page shows, or one of whose runs does, lists its runs
  under it in the sidebar, grouped by where they stand (`ConversationRunLinks` in
  `features/conversation-runs`).
- The runs of a conversation dataset (`features/conversation-runs`), on the API's
  `evaluation-conversation-runs` routes (`EvalConversationRunsRoutes`). Run evaluation, on a
  dataset's page, opens a side panel of the dataset's page, which the `run` search param shows
  (`RunEvaluationPanel`): the version of the agent, picked with the shared
  `AgentVersionPicker` (the one in production first, never the draft), the judge model, among the
  project's available ones (`GET eval/.../agent-models`, on the shadcn `native-select`), optional
  instructions for the judge, and all the records or the first ones. It creates the run, starts it,
  then opens its page. The Runs tab (`ConversationRunsSection`) lists the agent's runs of the dataset (a run
  of another agent of the project shows on that agent's pages), in one sub-tab per status that holds runs (`RUN_STATUS_ORDER`). Each run shows by its short id, which opens it, and how long ago it started, the
  shared `RelativeTime`. A run's version opens the
  history of the agent's versions on it, the shared `AgentVersionsSheet` without its choice, to
  compare it with the others. A run's page, `evaluations/$datasetId/runs/$runId`
  (`ConversationRunPage`), shows its figures and all its records, with what it used in a side panel of two tabs (`RunSettingsPanel`): Agent, with its
  type, the version asked, which opens the history of its versions, its model, its thinking level
  (`thinkingLevelOf`) and its instructions, and Judge, with its model and its instructions; its records are read as a dataset's, with
  Cancel while it is under way, after a confirmation, and a « ⋯ » menu that holds Retry, after a
  failure, and Delete. Its scores read out of 5, as the judge gives them (`scoreOf`). Filters above its results narrow them to
  the errors, the low scores, the records that wait or were not asked (`result-filters.ts`): only
  those that keep something show, and the `result` search param holds the one chosen. The table cuts each text after three lines; a row opens its
  record whole in a sheet (`RunRecordSheet`), its expected output and its answer rendered from
  Markdown. A run under way is read again
  every 3 seconds (`refetchInterval` in `api/queries.ts`), not through the API's status stream.
  The table also shows where each record stands and, once a record has one, the form the
  agent filled (`FilledForm`). Two runs or more, picked by their boxes, compare side by side
  (`ConversationRunsComparePage`): their figures, then the score of each record.
- In the sidebar, of Evaluations and Campaigns, only the menu that holds
  the current page opens at first, and both on a page neither holds (`useOpenSidebarTopMenu` in
  `src/routes/-components/`).
- What the evaluations of both types of agent share lives in `components/shared/` and `lib/`, and
  each feature gives its own data, texts and calls: the list of datasets (`DatasetsListPage`,
  `DatasetsTable`), the dialogs that create, rename and delete one (`DatasetDialogs`, which takes
  the feature's mutations as `MutationLike`), the frame of a dataset's page (`DatasetPageFrame`),
  the sidebar's entries (`DatasetsSidebarEntries`, `DatasetSidebarLinks`, `RunSidebarLinks`), the
  runs of a dataset (`RunsSection`, which takes the feature's runs, its delete mutation and its
  table; `RunsByStatus`, whose sub-tab the `status` search param holds; `RunRowActions`,
  `RunVersionButton`, `DeleteRunDialog`), the top of a run's page (`RunPageHeader`), what a run
  used about its agent in its side panel (`RunAgentFacts`, `RunFact`), the filters of its results
  (`ResultFilters`), how many records a new run asks (`RunScopeField`, on `lib/run-scope.ts`), a
  run's statuses (`lib/run-status.ts`), the search params of the datasets' pages
  (`lib/dataset-search.ts`) and of a run's page (`lib/run-search.ts`), the roots of the runs'
  query keys, which a dataset's deletion invalidates (`lib/run-query-keys.ts`), the skeleton of
  the evaluation pages (`EvaluationPageSkeleton`), a number in a cell (`Count`) and the greens of
  what goes well (`lib/success-classes.ts`).
  The routes under `evaluations/` are the same for both types: each picks its feature from
  `agent.type`.
- `DataTable` calls the function of a cell or of a header, where `flexRender` would mount it as a
  component: a table builds its columns at each render, with the handlers of its props, and what
  a cell holds keeps its state all the same (a row's open menu while a run under way is read
  again). A cell that needs a hook is a component the function returns.
- A table of records the API pages keeps its page, its order and its search in the URL
  (`lib/records-search.ts`: `recordsSearchSchema`, `recordsQueryOf`, which builds the API's
  `columnFilters`, `sortBy` and `sortOrder`), reads its page with `useQuery` and
  `keepPreviousData`, a page its route's loader starts unawaited, and shows `ColumnFilters` (a column and the text it must hold, applied on Enter
  or the button, several columns at once, each filter with the way to take it away) and `TablePagination` around the `DataTable`. The route's component gives the search
  and takes its changes. The records of an extraction dataset, the results of an extraction run
  and the comparison of runs work that way, 50 rows a page. The records of a conversation dataset
  and of a conversation run, written by hand and few, are still read whole.
- What the former evaluation app did (`apps/web/src/eval`, removed since: read it in the git
  history) is the reference for both types of agent: its behaviours are kept unless the product owner asked otherwise. Kept on purpose from
  it: the "N records remaining" badge and the progress text of a run under way
  (`RunPageHeader`, `RunProgressNote`), a toast when a run a person watches ends
  (`useRunEndToasts`, on the polled data), the trace of an answer for who holds `trace.read`
  only (`canReadTracesQueryOptions`), the agent's temperature, document search and a link to the Studio
  in a run's panel, the row numbers of the tables, the select-all box of the runs, and the
  former URLs, `/o/$organizationId/p/$projectId/conversation/...` and `.../extraction/...`,
  which redirect to the same page under an agent (`legacy-evaluations-redirect.ts`). A run's
  page is the page of one agent: a run of another agent is not found there. Changed on purpose:
  pages under one agent, a run started from a side panel of its dataset's page, polling in place of the status stream, and
  a confirmation before a run is cancelled.
- The evaluations of an extraction agent (`features/extraction-datasets`,
  `features/extraction-runs`), on the API's `evaluation-extraction-datasets` and
  `evaluation-extraction-runs` routes. A new dataset has no record: its page shows what builds
  them (`ExtractionDatasetSetup`), a CSV file of the project to choose or to upload (presign, PUT
  to the signed URL, confirm), then the dataset's name, and the name and the role of each of its columns: input, target,
  reference or ignore (`lib/extraction-columns.ts`). A dataset with records shows them a page at a time, with
  every column and its role, and a row opens its record whole in a sheet: the API pages, sorts and searches them, as a dataset may hold
  thousands (`ExtractionRecordsSection`). A new run, in a side panel of the dataset's page
  (`RunExtractionPanel`), picks a saved version, pairs each field of the version's output schema
  with a target column or only shows it (`key-mapping.ts`), and asks all the records or the first
  ones. The Runs tab adds a box per run: two runs or more open in
  `evaluations/$datasetId/compare?runs=`, their figures then each record side by side. The box is
  the cell's own component (`RunCompareCheckbox`) on TanStack's row selection, so it is not
  remounted, and keeps the focus, when the table renders again. A run's page shows its match rate,
  its matches, mismatches and errors, then its results: for each field the value expected, when
  the field is compared, then what the agent returned with a mark, a column of the errors when
  a record of the page has one, filters by status, and a sheet with the whole record.
  Its results come a page at a time too, as the comparison's records do. Its side
  panel has two tabs, Agent and Fields. A run that is over offers its results as a CSV file
  (`useOpenRunCsv`), from a button beside the filters of its results, and from its row's menu in
  the Runs tab. A run under way is read again every 3 seconds.
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
- A campaign runs on one saved version of its agent's settings (`agentSettingsId`): the API
  gives the tester's chat, the tester's context and the reviewer's view that version, whatever
  goes to production meanwhile. The Campaign step names it (`AgentVersionField`), the one in
  production by default, and opens the agent's history in a sheet (`AgentVersionsSheet`), as the
  Studio shows it: the saved versions, never the draft, each one's changes against the version
  before it or the one in production (`lib/agent-version-diff.ts`, drawn by `@pierre/diffs` in
  `TextDiff`, the Studio's library), and a button that selects it. The picker, the sheet and
  their parts live in `components/shared/`, since a run picks and shows a version too; they take
  the versions, which `agentVersionsQueryOptions` of `features/agents` reads from
  `GET eval/.../agents/:agentId/settings` (`agent.settings.read`, which a campaign's managers hold).
  The General card of `CampaignSetupView` names the version of a campaign that no longer changes.
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
- MCP Apps: a card runs in the sandbox of `@bayes-platform/mcp-app-host`
  (`packages/mcp-app-host`), one of the two packages the app shares with the Desk, `apps/web` and
  `apps/web-embed` (ADR 0031, section 2.4). The other is the permission catalog,
  `@bayes-platform/permissions`, which the app reads only through the constants its contracts
  re-export (section 2.12). The chat keeps what is its own, as the Desk does: the
  `useMcpApp` hook and `McpAppCard` in `features/conversation`, and the lookup of an app's HTML.
- A rating, a comment and the answers to a campaign's questions go through one form,
  `components/shared/RatedFeedbackForm.tsx` (`lib/rated-feedback.ts`), for the tester's feedback
  and survey and the reviewer's review. The API checks the rating only: the form holds the
  required answers.
- A date in a table or under a title reads as how long ago it was, with the full date and time
  on hover: `TimeAgo` (`components/shared/`), which follows the clock by itself and words the time with
  `date-fns` (`timeAgoOf` in `lib/time-ago.ts`), a library a human chose for it. The chat keeps the
  Desk's `RelativeTime`, on `Intl`.
- The API client: `src/lib/api-client.ts`. The query client's retry rules:
  `src/app/query-client.ts`.
- The mocked API: `src/test/msw/handlers.ts`, with one file of handlers per area beside it
  (`campaign-handlers.ts`, `conversation-dataset-handlers.ts`, `conversation-run-handlers.ts`,
  `extraction-dataset-handlers.ts`, `extraction-run-handlers.ts`), written with `mockRoute`
  and `mockStreamRoute` (`src/test/msw/mock-route.ts`) and fed by the factories of
  `src/test/factories/`, whose `eval-world.factory.ts` builds the worlds: the owner of a project
  with campaigns who evaluates it too (the main one), an owner who does not, a person who holds
  everything at once, a participant who only tests and reviews, and the edge cases.
  Its URLs come from `src/test/eval-urls.ts`.
- The stories, in six folders of Storybook under `Evaluation`: `General`
  (`src/stories/Eval.stories.tsx`), `Conversation evaluations`
  (`ConversationEvaluations.stories.tsx`), `Extraction evaluations`
  (`ExtractionEvaluations.stories.tsx`, on `buildExtractionWorld`, with a spec of its own),
  `Review campaigns` (`Campaigns.stories.tsx`), `Reviewer`
  (`Reviewer.stories.tsx`) and `Tester` (`Tester.stories.tsx`), with the meta of
  `src/stories/eval-meta.tsx`. `src/stories/Eval.stories.spec.tsx` renders every story in the
  tests.
