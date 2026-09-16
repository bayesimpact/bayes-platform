# Live provider regressions

Everything in this folder talks to LIVE LLM endpoints (vLLM deployments,
Vertex AI). **None of it runs in CI**, by construction:

- jest does not even COLLECT `*.live.spec.ts` files unless
  `LIVE_PROVIDER_REGRESSIONS=1` is set (`testPathIgnorePatterns` in
  `jest.config.ts`) — importing them needs network credentials and node
  flags, so they must never load in CI. Name every new live spec
  `*.live.spec.ts` to inherit this exclusion.
- The `describe.skip` gate on the same env var is kept inside the specs as a
  second layer.
- `measure-citation-rate.ts` is a plain ts-node script (deliberately not a
  `*.spec.ts`, so jest never collects it).

## Contract suites

One production-shaped turn per provider/model (`provider-cases.ts` is the
shared matrix; unavailable providers auto-skip with a visible reason). Both
run the full pipeline of ADR 0016: answering loop with conversation tools
only, inline citation extraction on the stream, then the post-turn
classification call (structured output).

- `rag-turn.live.spec.ts` — RAG turn on the handbook fixture: grounded
  answer (the fixture value is deliberately NOT the statutory number, so a
  correct answer proves retrieval), no citation marker left in the text,
  sources logged exactly once (inline citations, or the classifier's
  attribution when the model cited nothing), metadata logged exactly once
  with in-list categories.
- `fat-prompt-turn.live.spec.ts` — no-RAG agent with a ~9k-token system
  prompt and strict guardrails (anonymized production shape), across
  greeting / service question / strict refusal / off-topic: metadata logged
  exactly once, in-list categories, a title on non-greeting turns.

Run them with (NODE_OPTIONS required by google-auth dynamic imports):

```bash
LIVE_PROVIDER_REGRESSIONS=1 NODE_OPTIONS=--experimental-vm-modules \
  npx jest --runInBand --forceExit src/external/llm/providers/live-regressions
```

## Behavior measurement (not a test)

The contract suites assert outcomes; `measure-citation-rate.ts` measures HOW
the outcome was reached over repeated attempts (temperature 0 is not
deterministic): the inline citation rate versus classifier attribution, the
grounding rate, the title and category outputs. Use it to evaluate prompt
iterations on the citation rule or the classifier prompt before changing
the production wording:

```bash
NODE_OPTIONS=--experimental-vm-modules npx ts-node --transpile-only \
  -r tsconfig-paths/register \
  src/external/llm/providers/live-regressions/measure-citation-rate.ts \
  --model gemini-3.6-flash --scenario rag --attempts 5
```

The serving-level counterpart of these suites (raw vLLM behavior: parser
regressions, tool_choice modes) lives in the infra repo:
`infra/vllm/gemma4-regressions/`.
