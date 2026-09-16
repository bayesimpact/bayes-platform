# ADR 0014: Mandatory Bookkeeping Tool — Declared in the Loop, Guaranteed by One Forced End-of-Turn Generation

* **Status**: Superseded by ADR 0016 (post-turn classification and inline citations)
* **Date**: 2026-07-30
* **Deciders**: Jérémie
* **Scope**: Backend `apps/api` — streaming pipeline (`external/llm/ai-sdk-llm-provider-base.ts`, `domains/agents/.../streaming/tools.service.ts`, `tools/mandatory.tool.ts`).

---

## 1. Context and Problem Statement

Every conversation turn must produce, besides the streamed text answer, one
bookkeeping report: session categories, a title suggestion, and — for RAG
agents — the source chunks actually used. This report is a tool call the
model is asked to make.

Small models do not make that call reliably. On a production-shaped
~15k-token prompt, the voluntary-call rate at temperature 0 ranged from 0/8
(gemini-3.5 family) to 3/8 (gemini-3.6-flash, before this work). Calls that
did happen sometimes carried broken arguments (empty `{}`, off-enum values
under user injection). Every measurement in this ADR comes from replaying a
captured production request N times against the raw provider endpoint —
temperature 0 is not deterministic, so single runs prove nothing.

Three hard constraints shape the solution space, all verified empirically:

1. **Forcing the call suppresses the text answer.** `toolChoice: "required"`
   (Gemini mode `ANY`, Anthropic `{"type": "any"}`) produces the call and
   nothing else — on every Gemini model tested, on Gemma 4, and on Claude
   Opus 5. There is no single-generation "force the call AND answer" mode.
2. **Server-side schema validation is not universal.** Real enforcement is
   constrained decoding (the schema compiles to a grammar that masks logits
   at every step). Gemini offers it (mode `VALIDATED`) and keeps the text —
   but validates without forcing. vLLM offers it for structured output and
   for parsers with structural tags — but the Gemma 4 parser has neither:
   it text-parses the model's native non-JSON format after the fact, so
   `strict` is a no-op and injected off-enum arguments reach the client
   as-is.
3. **Models skip "optional-feeling" calls on trivial turns.** Names like
   `submit_turn_summary` presuppose that something happened; on a greeting
   there is nothing to summarize, so the model treats the call as not
   applicable — regardless of how imperative the prompt instruction is.

## 2. Decision

### One composite, obligation-named tool

All fire-and-forget reporting is a single tool, `mandatory_tool`
(categories + title + cited chunk ids). The name carries the obligation;
the description carries the semantics. Renaming from `submit_turn_summary`
took the voluntary rate on the production prompt from 3/8 to 8/8 on
gemini-3.6-flash — the strongest effect of the whole prompt-engineering
campaign (moving or rewording the instruction moved nothing; a per-turn
reminder reached only 5/8). Execution dispatches to the legacy log names,
so persistence and the front are untouched.

### Declared in the answering loop, with fire-and-forget stop conditions

The tool is declared from step 1 like any other, so a cooperative model
calls it in the same generation as its answer — zero extra cost. Loop exit
conditions (`stopWhen`):

1. ai-sdk implicit: a step with no tool calls ends the loop.
2. `fireAndForgetStopCondition`: a step whose calls are ALL fire-and-forget
   AND which produced text ends the loop — without it, ai-sdk pays one more
   generation for the model to "react" to a logging tool's output.
3. `stepCountIs(20)` as a runaway safety net.

### Guaranteed by ONE forced end-of-turn generation

After the stream completes, the provider checks whether the tool
meaningfully EXECUTED during the loop. If not, it runs a single extra
`generateText` with `toolChoice: "required"` — at that point the user
already has the streamed answer, so the text-suppression constraint no
longer matters. This is a conditional catch-up, not a retry loop: one
attempt, best-effort (a failure logs loudly and never breaks the stream).

"Meaningfully executed" is accounting on executions, not calls:

* a voluntary call with invalid arguments never executed — it must not
  suppress the catch-up;
* an execution that recorded nothing (`{}` no-op report) does not count;
* an execution that ran BEFORE the knowledge-base lookup registered chunks
  cannot have cited sources — a freshness check (`sawKnowledgeBaseChunks`)
  marks it stale so the catch-up still runs.

### Schema quality: dynamic declaration + backend enforcement + Zod

* The tool's `description` and `inputSchema` are getters re-read by ai-sdk
  on every generation: `chunkIds` only exists once a lookup actually
  registered chunks in the turn; `categoryNames` only when the agent has
  categories; `suggestedTitle` always.
* On Vertex, loop tools are marked `strict` (prototype-based wrapper that
  preserves the getters) → Gemini mode `VALIDATED` → enum values are
  grammar-enforced at generation time, text preserved. The forced catch-up
  keeps NON-strict tools on purpose: with a strict tool the provider maps
  `required` to `VALIDATED`, which validates but does not force.
* Zod remains the universal barrier (Gemma has no server enforcement;
  Gemini does not enforce `maxLength`).

## 3. Alternatives Considered

| Alternative | Why rejected |
|---|---|
| Force the call in the answering generation (`required`/`ANY`) | Suppresses the text answer on every provider tested. |
| Rely on Gemini `VALIDATED` alone | Validates arguments but does not force the call; voluntary rate on big prompts stays 0/8 on the 3.5 family. |
| Rely on server-side schema validation | Absent on the vLLM gemma4 parser (post-hoc text parsing, `strict` no-op); `maxLength` unenforced on Gemini. |
| Hide the tool until the KB lookup ran (declaration gating) | Incoherent with the call-on-every-turn contract: the prompt demanded a call the API did not declare, pushing models into invalid hallucinated calls. Replaced by the runtime-dynamic schema. |
| Prompt engineering (instruction position, protocol wording, language) | Measured no effect on the ~15k-token production prompt (1-3/8 across variants). |
| Per-turn reminder message appended to the history | 5/8 — the second-best lever, but invasive (an earlier variant contaminated session titles) and still unreliable. |
| Full structured output instead of tool calling (token-level guarantee on Gemma) | Would require incremental JSON parsing to keep streaming the text field; kept as a future option. |

## 4. Consequences

**Positive**

* The report executes on every turn on every provider, with valid
  arguments, without ever costing the user their text answer.
* On models that volunteer (gemini-3.6-flash: 8/8, claude-opus-5: 4-6/8),
  most turns cost a single generation.
* The architecture is provider-agnostic: the same constraints were
  verified on Gemini, Gemma 4/vLLM, and Claude on Vertex.

**Negative / accepted costs**

* Models that never volunteer on big prompts (gemini-3.5 family) pay the
  forced catch-up on virtually every turn — one small extra generation.
* The catch-up is single-shot: if the forced generation itself produces no
  execution, the turn ends without a report (loud error log; observed only
  as transient provider errors).
* `mandatory_tool` is a semantically generic name; it is accurate today
  because the tool IS the composite of all mandatory reporting, but a
  second independent mandatory tool would force a rename.

## 5. References

* Live regression suites: `apps/api/src/external/llm/providers/live-regressions/`
  (all providers, CI-excluded) and the raw-API suites in the infra repo
  (`vllm/gemma4-regressions/`, `vertex/gemini-regressions/`,
  `vertex/anthropic-regressions/`).
* Full measurement log: `llm-tool-calling-measurements.md` in the infra repo.
* Related upstream issues: vLLM #45588/#45553 (gemma4 parser rewrite),
  #44522 (`<|"|>` token leak), #49712 (named tool_choice ignored).
