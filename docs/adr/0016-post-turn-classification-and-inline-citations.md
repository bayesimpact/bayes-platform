# ADR 0016: Post-Turn Classification and Inline Citations Replace the Mandatory Tool

* **Status**: Accepted (supersedes ADR 0014)
* **Date**: 2026-09-16
* **Deciders**: Jérémie
* **Scope**: Backend `apps/api` — streaming pipeline (`domains/agents/.../streaming/`, `tools/turn-classification.ts`, `tools/inline-citations.ts`, `external/llm/`).

---

## 1. Context and Problem Statement

ADR 0014 made the per-turn bookkeeping (session title, categories, cited
sources) a tool in the answering loop, `mandatory_tool`, declared from step
1 and guaranteed by one forced `toolChoice: "required"` generation when the
loop did not execute it. It worked, and it was the source of a whole family
of problems observed in production between July and September 2026:

1. **Leaked tool calls in the text channel.** Every variant the output
   sanitizer learned to strip (`<call:default_api:…>`, `<function:…{…}`,
   `Lie:default_api:…{…}`, bare `mandatory_tool{…}`) was a leak of this
   tool: small models verbalize a bookkeeping call they do not understand
   the purpose of. Four fixes in six weeks, each one a new regex, and the
   user-visible failures happened in a patient-facing deployment.
2. **The loop carried a tool that never interacts with the conversation.**
   With several obligatory tools per turn (fillForm, a handoff signal, the
   bookkeeping report), models asked two questions at once or skipped a
   form field: the extra step needed to satisfy every call is where the
   damage happened.
3. **Hybrid complexity.** Declaring the tool in the loop AND forcing it
   afterwards required dynamic schema getters, execution accounting
   (invalid calls, `{}` no-ops, stale reports made before the lookup), a
   fire-and-forget stop condition and a recency slot in the master prompt.
   Half of the streaming pipeline existed to keep one report alive.
4. **The prompt paid for it.** A "Response protocol" epilogue on every
   agent, a tool line, and a description that had to fight the agent's own
   instructions on big prompts, for a call rate that still depended on the
   model.

The same period also showed that a fire-and-forget tool is not a reliable
carrier for anything important: a safety signal that rides on a tool the
model may forget, or emit in the wrong channel, is silent when it fails
(internal follow-up on the safety signal).

## 2. Decision

### Nothing in the answering loop that does not talk to the conversation

The loop declares only the tools whose output the model consumes or that
act for the user: knowledge base lookup, fillForm, resource cards, MCP
tools, sub-agents. No bookkeeping tool, no forced end-of-turn generation,
no response protocol in the prompt. The provider layer streams the answer
and recovers verbalized calls to the remaining tools; that is all.

### Sources: inline citations parsed from the stream

The model cites a retrieved passage by writing its alias in square
brackets right after the sentence it supports (`[c1]`, `[c1, c3]`). The
aliases are the ones the lookup already assigns (c1, c2, …), so the model
copies two characters it has just read. The citation rule lives in the
lookup tool description and on its master-prompt line, only when the
project reports sources.

A streaming extractor (`inline-citations.ts`) removes the markers from the
text the user sees and persists, holding back an unclosed `[` until its
closer arrives, and records the cited aliases. The server resolves them to
the real chunks and logs a `Sources` entry, exactly as before.

This is the standard grounding pattern (Perplexity, Gemini grounding,
Claude and Cohere citations): the citation is produced where the passage
is used, at zero extra cost, and it carries the position for future
per-sentence footnotes.

### Everything else: one post-turn classification call

After the reply is complete and persisted, one structured-output call
(`turn-classification.ts`) produces the session title, the categories
(closed enum) and, when passages were retrieved and none was cited inline,
the passages the reply relies on (closed enum of the aliases). It reads a
short prompt of its own: the latest exchange, a few earlier messages for
context, the category list, the passage excerpts. It never sees the
agent's system prompt, runs at temperature 0 on the agent's model, and is
best-effort: a failure is logged and the stream is already complete.

Structured output, not tool calling: there is no text to preserve, so the
constraint that made forcing a tool call impossible in the answering
generation ("required" suppresses the answer) no longer applies, and on
Gemma the JSON schema is the only token-level guarantee available.

The results are logged under the historical tool names (`Sources`,
`RecalculateConversationSessionMetadata`): persisted tool calls, the
activity timeline, the sources panel and the analytics are untouched.

### Where it runs

The post-turn step is exposed by `AgentLlmRequestService.buildLLMRequest`
(`citations`, `classifyTurn`) and called by every runner of an agent:
Studio and app streaming, public embed streaming (with the public session
as metadata target), evaluation single turns and relay sub-agents (sources
only, they have no session of their own to title).

## 3. Alternatives Considered

| Alternative | Why rejected |
|---|---|
| Keep the mandatory tool for RAG agents only, classify the rest | Keeps all the hybrid machinery for the agents with the biggest prompts, where the leaks were worst. |
| Post-hoc attribution of sources by the classifier only (no inline citations) | One more generation on every RAG turn, and the classifier has to be shown the passages again. Kept as the fallback when the model cites nothing. |
| Persist the citation markers and render footnotes in the front | The right end state, but the aliases restart every turn and the front change is independent; v1 strips the markers and keeps the per-message sources panel. |
| Same-model second pass with the full agent prompt | The classifier does not need the agent's persona, and the fat prompt is what made the bookkeeping call unreliable in the first place. |
| A cheaper platform-wide classifier model | Crosses the EU data residency arbitration per client; the agent's own model is the safe default. Left open as a setting. |

## 4. Consequences

**Positive**

* No bookkeeping tool the model can leak, skip or verbalize; the leak
  sanitizer is back to protecting real tools (fillForm, MCP, safety).
* The answering loop only carries conversation tools, which removes the
  multi-obligation step that produced doubled questions.
* Dynamic schema getters, execution accounting, staleness checks, the
  fire-and-forget stop condition for the report and the prompt epilogue
  are gone.
* Title and categories are computed on every turn on every model, from a
  prompt that is the same for every agent.
* A guaranteed post-turn slot exists for future classifications (safety
  signal, handoff conclusion) without touching the answering loop.

**Negative / accepted costs**

* One small extra generation on every turn, including on the models that
  used to volunteer the report in their answer. The models that never
  volunteered already paid the forced generation.
* The classifier sees the exchange, not the model's intent: when the
  model cites nothing inline, source attribution is an inference from the
  final text. Measured by the live suites and `measure-citation-rate.ts`.
* Citation markers are stripped in v1; the position information they carry
  is not yet shown to the user.

## 5. References

* ADR 0014 (superseded): the measurements that led to the mandatory tool
  and the constraints on forced tool calls, still valid.
* Live regression suites: `apps/api/src/external/llm/providers/live-regressions/`
  (`rag-turn.live.spec.ts`, `fat-prompt-turn.live.spec.ts`,
  `measure-citation-rate.ts`).
