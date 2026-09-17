# ADR 0018: A Sub-Agent Takes the Conversation Over (Handoff)

* **Status**: Accepted
* **Date**: 2026-09-17
* **Deciders**: Jérémie
* **Scope**: Backend `apps/api` (`domains/agents/.../streaming/`: `handoff-turn-loop.ts`, `active-agent-scope.service.ts`, `tools/handoff.tool.ts`, `tools/conclude-handoff.tool.ts`, `public-chat.service.ts`), API contracts, Studio.

---

## 1. Context and Problem Statement

A parent agent uses its sub-agents as tools: it calls one with a task, reads
the answer, and writes its own reply. This "relay" is right for an expert the
parent consults. It is wrong for a sub-agent that must lead an interview: the
parent rephrases the sub-agent's questions, asks some of them itself, forgets
what was already answered, and the interview never ends. Two models speak for
one voice, twice per turn.

An earlier prototype ran the sub-agent in a sub-session of its own, with a
per-turn classifier to detect its conclusion and the parent replaying the
sub-session's results. It showed the direction and its costs: a second
transcript to merge back, an extra generation per turn, and a form state the
parent could not read.

## 2. Decision

**One agent speaks at a time, in one conversation.**

* A sub-agent link has a **mode**: `relay` (the tool call, unchanged) or
  `handoff`. A link in handoff mode is exposed to the parent as a tool of the
  same name whose execution does not run the child: it records the child as
  the session's **active agent** (`active_agent_id` on the session, for Studio
  and embed sessions alike) and tells the parent to write one transition
  sentence and stop.
* **The active agent answers the user's next messages**, in the same session,
  with its own prompt, tools and published settings. It sees the whole
  transcript and a "Hand-over" section naming the parent. The parent is not in
  the turn.
* **The child hands the conversation back itself** with the `concludeHandoff`
  tool, which clears the active agent (only if the child still holds it) and
  marks the child's form in the conversation as concluded (ADR 0017).
* **Auto-continuation.** After a turn, the platform re-reads the active agent.
  If it changed, the next agent's turn runs in the same response, triggered by
  a user-role message that is sent to the model and never stored: the child's
  first question follows the hand-over sentence, the parent's resumption
  follows the child's conclusion. Capped at four turns per user message.
* **No second handoff to a concluded form.** One form per agent and per
  conversation (ADR 0017); the tool refuses and returns the collected state,
  so the parent decides the next step from it.
* **One hand-over per turn, and the turn ends there.** A model that keeps
  generating after the hand-over tool (observed with Gemma: it calls a second
  questionnaire in the same turn, then talks in the sub-agent's place) would
  move the conversation to the last agent called, not to the one it announced.
  The handoff tools of a turn share a state: the first call wins, later calls
  are refused with the name of the agent that took over. The hand-over tools
  are declared terminal to the tool loop: once one ran, the loop allows one
  more generation for the closing sentence (none when the hand-over step
  already carried it) and stops, whatever else the model would call.
* **No nested handoff.** A child in control keeps its relay links but gets no
  handoff tools: its conclusion always returns to the session's agent.

## 3. Consequences

* **Studio.** The stream of one user message can carry several replies (one
  `start`/`end` each). The transcript shows who wrote each message, the header
  shows who the user is talking to.
* **Embed (public API).** The contract is one reply per request. The turns of
  one request are folded into one reply: the first `start`, every chunk, one
  `end` whose text joins the turns with a blank line. Each turn is still stored
  as its own message, attributed to its agent, which is what the session read
  returns. No change to the published event sequence.
* **Data.** `agent_sub_agent.mode`, `active_agent_id` on both session tables.
  Messages already carry the settings revision, hence the agent, that wrote
  them; the DTO now exposes `agentId`.
* **Ending and returning (second change, same day).** The post-turn
  classification (ADR 0016) of a child's reply also answers `taskConcluded`
  and writes a `handoffSummary`. A conclusion the child forgot to signal is
  applied from that reading; a conclusion it signaled with its tool is not
  repeated. The summary is stored on the child's conversation form
  (`summary`, ADR 0017); a child without a form gets a concluded row so its
  summary has a place. Two prompt sections are rebuilt every turn from the
  conversation's forms: the parent reads what each handoff child collected
  and whether it concluded ("Your sub-agents in this conversation"), a child
  in control reads what other agents already collected ("Already known about
  the user", read-only: it does not ask again). No new call: the classifier
  already runs after each reply.
* **Form consolidation at conclusion (third change).** When a sub-agent with
  a form concludes, the platform reads its part of the transcript once (from
  its first reply, with the user's messages in between) with the form schema,
  every field nullable, at temperature 0, under the rule "only what the user
  stated, null otherwise". It adds the fields the exchange left empty and
  never overwrites a value fillForm wrote, whatever the extraction says.
  Logged as a `consolidateForm` tool execution with the added fields, traced
  under `· consolidation`. One call per hand-over, none when the form is
  complete. Forcing fillForm on every turn was tried before and rejected: it
  makes the model invent values.

## 4. Alternatives Considered

* **A sub-session per handoff child**, merged back into the parent transcript
  for display. Two transcripts, two traces, a form the parent cannot read
  without an extra endpoint. Rejected in favor of one session.
* **Inferring the conclusion from form completeness.** Fields that do not
  apply are never filled; completeness is not a signal. The child says when it
  is done.
* **A second reply in the public stream.** Breaks the one-reply-per-request
  contract for the integrator that consumes it. Folding keeps the contract and
  the per-agent attribution in storage.
