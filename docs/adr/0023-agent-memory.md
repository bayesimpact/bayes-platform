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
* **A setting per agent, behind a project flag.** `memoryMode` on the settings
  revision is `off` (default), `ask` or `auto`, and the `agent-memory` feature
  flag gates the whole capability per project.
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
  handful of facts fits in the prompt and is always relevant.
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
  misses one.
