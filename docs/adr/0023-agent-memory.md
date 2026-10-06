# ADR 0023: Conversation agents remember facts about a user

* **Status**: Accepted
* **Date**: 2026-10-05
* **Deciders**: Alexis
* **Scope**: Backend `apps/api` (`domains/agents/memories/`, `streaming/tools/memory.tools.ts`, `tools.service.ts`, the retention sweep worker), API contracts, Studio and Desk conversation views.

---

## 1. Context and problem statement

Every conversation with an agent starts from zero. For a coach, an assistant
that follows someone over weeks, or an agent that should keep a user's
preferences, the user has to repeat the same context in each session. We want
an agent to keep a few facts about a user between conversations:

* the user can say "remember this for later";
* the agent can decide by itself that something is worth keeping;
* the agent can ask the user before keeping something.

The platform already has three ways to extend an agent: built-in tools (code
in `tools.service.ts`), MCP servers (outbound HTTP, configured per project) and
Apps (external programs calling `apps/v1` with a service user). Memory had to
pick one of them.

## 2. Decision

**Memory is a built-in tool pair backed by an `agent_memory` table in the API.**

* **Scope: one agent and one user.** A fact belongs to `(agent, user, session
  type)`. Agents of the same project do not share what they know, and the
  playground keeps its own memory so a builder's tests never reach live users.
* **Signed-in users only.** Embed visitors have no user row and an
  `externalVisitorId` chosen by the host page, so they get no memory, and the
  public contract does not change. Evaluation runs (no user) and
  review-campaign sessions (test material) get none either.
* **A setting per agent, with no feature flag.** `memoryMode` on the settings
  revision is `off` (default), `ask` or `auto`. Every project has it; an agent
  remembers nothing until a builder turns it on, and the conversation view only
  shows the memory button once the agent remembers something.
* **Two tools.** `saveMemory` takes up to five short facts, each tagged
  `user_request` or `inferred`. `forgetMemory` deletes facts by the alias the
  prompt shows (`m1`, `m2`...), resolved server side like the resource
  aliases. The mode is enforced by the server, not left to the prompt: in
  `ask` mode an `inferred` fact is stored as a `pending` proposal, while a
  fact the user asked to remember is saved at once.
* **Recall by prompt injection.** Each turn adds a "Your memory of this user"
  section with the saved facts and the pending proposals. Caps keep it small:
  50 saved facts of at most 300 characters, 10 pending proposals. Over a cap,
  the tool refuses and tells the model why. There is no vector search: a
  handful of facts fits in the prompt and is always relevant. Recall through
  a tool the model calls was rejected for now (see section 4), and section 5
  describes the index-and-recall design to switch to if injection becomes a
  problem.
* **Approval out of band.** The `saveMemory` tool call stores the proposals
  on the assistant message. The conversation view renders them as a
  questionnaire under that message (save, discard, or reword), and the answer
  goes to `POST .../memories/:sessionType/resolve-proposals`. The turn never
  pauses and nothing resumes it: the next turn simply sees the approved facts.
* **The user owns their memory.** The routes under
  `agents/:agentId/memories/:sessionType` list, delete one, delete all and
  resolve proposals. They require `agent.read` on the agent (whoever can talk
  to it) and every query is keyed on the caller's user id, so no role can read
  another user's facts. Deleting or rejecting a fact removes the row.
* **Retention of its own.** Memory outlives the conversation retention purge
  on purpose. The nightly retention worker deletes saved facts untouched for
  180 days and proposals unanswered for 7 days. Deleting the agent or the user
  cascades.

## 3. Consequences

* Memory works with every model and provider, since it only uses ordinary
  tool calls and prompt text.
* The prompt grows by the memory section on every turn of an agent with
  memory on. The caps bound it to a few thousand tokens at worst.
* Every fact is visible on every turn, including turns where it is useless,
  such as a greeting. The model can bring a fact up out of place, which the
  prompt counters by asking it to use facts "without reciting them". Worse,
  the facts are sent to the LLM provider and written to the traces on each
  turn, so personal data (health, family) travels far more often than it is
  needed. We accept this for v1 and keep section 5 ready.
* The model can mislabel an inferred fact as a user request and skip the
  approval. The user still sees every fact in the memory panel and can delete
  it, and the "saved to memory" mark on the message makes each save visible.
* Builders and admins cannot see what an agent remembers about their users.
  This is deliberate for v1. Exposing it would need its own permission and a
  privacy review.
* Facts are stored as plain text, like messages. They can hold personal data
  the user chose to share; the agent is told never to keep credentials or
  payment details.

## 4. Alternatives considered

* **An MCP server.** The API exposes no MCP server, its MCP context headers
  carry no user id, MCP results are deliberately not persisted, and an MCP
  server cannot add the memory section to the prompt. Recall would need an
  extra tool call every turn.
* **An App.** Apps call the platform's REST API from outside and never reach
  the model, so they cannot give an agent tools or prompt context.
* **Approval through the AI SDK `needsApproval` flow.** It needs a paused
  turn, a new stream event, a message state and a resume endpoint, none of
  which exist today. Out-of-band proposals give the same control with no
  change to the stream protocol.
* **Memory shared by all agents of a project.** More powerful, but one
  agent's notes would shape another agent with a different purpose, and users
  could not tell which agent knows what. It can come later as an opt-in.
* **Semantic recall with pgvector.** Worth it once memories outgrow the
  prompt. With 50 short facts, injecting all of them is simpler and never
  misses one. Filtering the injected facts by similarity to the user's
  message would also hide facts on useless turns, but it needs a tuned
  threshold, can miss a fact, and drops standing preferences ("answer in
  bullet points") that look like no message.
* **A `getMemory` tool instead of injection.** The model would have to
  decide to call it, but memory mostly serves implicit personalization: on
  "suggest a training plan", nothing tells the model it holds useful facts
  until it has read them. Small models already need forceful prompts to call
  `lookup_knowledge_base`, and `ownFormState` exists because models stop
  calling `fillForm` without injected state. Calling it on every turn is
  injection with an extra round trip, more tokens and one more way to fail.
* **Gating recall with the turn classifier.** The classification call runs
  after the answer, so it could only gate memory by adding latency before
  every reply.

## 5. Planned evolution: an index and a recall tool

If facts showing on useless turns becomes a problem (a fact surfaced out of
place, or a privacy review asking to minimize what reaches the provider),
recall switches to an index plus a tool, without changing the tables' purpose
or the user-facing routes.

* **Two kinds of fact.** `saveMemory` gains a `kind` per item:
  `preference` (language, tone, format, anything that shapes every answer) or
  `fact` (something about the user: health, family, work, goals). A
  preference is still injected in full every turn, since a model never thinks
  to look up how it should write. `saveMemory` also takes a short `label`
  (a few words, "height and weight") for each `fact`.
* **The prompt shows an index.** The memory section lists preferences in
  full and facts as `alias: label` only, e.g. `m1: height and weight`. The
  model knows a fact exists without seeing its content, which makes it far
  more likely to fetch it than a blind `getMemory`. This is the same pattern
  as the `r1`, `r2` resource aliases of `surfaceResources`.
* **A `recallMemory` tool.** It takes aliases, resolves them with the
  existing `MemoryAliasRegistry`, and returns the contents. The round trip
  is only paid on turns where memory helps. Pending proposals stay in the
  prompt in full: they are short-lived and the model must not propose them
  again.
* **Storage.** Two columns on `agent_memory`: `kind` (default `fact`) and
  `label` (nullable). Existing rows have no label, so the migration either
  backfills one from the first words of the content or shows those rows in
  full until they are rewritten.
* **User side.** The memory panel and the approval questionnaire show the
  label and the kind, so the user can fix a fact filed as a preference. The
  user-facing routes do not change.
* **Risk.** A small model may skip `recallMemory` when it should call it.
  Before switching, an evaluation on the smallest supported model (Gemma)
  should compare both designs on greetings, off-topic questions and questions
  where a fact matters. Missing a fact is still a smaller harm than reciting
  a health detail on a greeting.

## 6. Planned evolution: forming inferred facts outside the reply

Today the answering model decides, in the middle of its reply, that a fact is
worth keeping and calls `saveMemory` with origin `inferred`. This is the
weakest part of the design: models use context well but do not reliably
create durable context, and doing the task competes with learning from it.
A small model either answers and forgets to save, or saves trivia.

* **Split by origin.** `saveMemory` during the turn stays for explicit
  requests ("remember that..."), which models handle well because the user
  names the tool's job. Inferred facts move to a separate pass, and the
  answering prompt loses its instructions about them.
* **Where the pass runs.** The cheapest place is the post-turn
  classification call (`turn-classification.ts`), which already reads the
  latest exchange with a short prompt of its own and a structured output.
  It gains an optional list of facts worth keeping, given the saved facts
  and pending proposals so it does not repeat them. This follows ADR 0016,
  which moved what the platform needs to know about a reply out of the
  answering loop for the same reason. If one exchange is too narrow a view,
  the pass can instead run once per session from a worker, after the
  session has been idle for a while.
* **Same storage and approval.** The pass writes through
  `AgentMemoriesService` like the tool does, so the caps, deduplication and
  modes still apply. In `ask` mode the facts it finds become pending
  proposals, and the approval questionnaire attaches to the assistant
  message of the turn it read. Facts stay small independent rows, so the
  tool and the pass can both write without any merge step.
* **No rewriting.** The pass adds or proposes facts and never rewrites or
  merges saved ones. Memories refined over and over by a model drift toward
  generic and lossy text; the user, through the panel, stays the only one
  who edits.
* **Cost.** A few more output tokens on a call that already runs, or one
  extra call per session for the worker variant.

Sections 5 and 6 are independent and can ship in either order. Both match
what Letta reports from its own agents: pinned context plus an index read on
demand, and memory formed by a background reflection pass rather than by
the agent doing the task ("Memory Models: Towards Agents That Learn", June
2026, and "Introducing Context Repositories", February 2026, on letta.com).
