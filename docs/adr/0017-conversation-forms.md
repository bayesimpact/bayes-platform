# ADR 0017: Forms Belong to the Conversation

* **Status**: Accepted
* **Date**: 2026-09-17
* **Deciders**: Jérémie
* **Scope**: Backend `apps/api` (`domains/agents/shared/conversation-forms/`, the fillForm tool, the session controllers, review campaigns, retention), API contracts, Studio and tester fronts.

---

## 1. Context and Problem Statement

The fillForm tool stored the answers it collected in a `result` JSON column
on the session row: one on `conversation_agent_session`, a copy on
`public_agent_session` for embed sessions. One session, one blob, no owner
beyond the session itself.

Two things made that model too small:

1. **Sub-agents that fill forms.** A parent agent delegates to a form
   sub-agent. Today the child runs in a sub-session with its own `result`,
   and the parent only learns about it through an extra endpoint that lists
   sub-sessions. The next step, handing the conversation over to a
   sub-agent inside the parent's session (one conversation, several agents
   talking in turn), needs several forms in one session, each owned by the
   agent that fills it, readable by the others so questions are not asked
   twice.
2. **Which schema produced the state.** Agent settings are versioned, and a
   conversation follows the agent's current revision on purpose. Nothing
   recorded which revision wrote a given form state, so the review campaign
   reviewer read every session's answers against the latest schema.

## 2. Decision

A conversation keeps every form filled in it. Forms live in their own table,
`conversation_form`, one row per (session, agent):

| Column | Meaning |
|---|---|
| `session_id` | The conversation or public session. No foreign key, like `agent_message.session_id`, so both session tables can own forms. |
| `agent_id` | The agent that fills this form (the session's agent, or a sub-agent running in the session). |
| `agent_settings_id` | The settings revision in force at the last write, as on messages. It says which schema produced the state. |
| `status` | `in_progress` or `concluded`. Nothing concludes a form yet; the handoff work will. |
| `state` | The collected answers, keyed by field. |

Rules:

* **One form per agent and per conversation.** Writes merge field by field
  into that row; a field collected earlier stays until the same key is
  written again (and an unknown value never erases one, see the fillForm
  cast rules).
* **Read with the current revision.** The Studio, the public API and the
  prompt read a form against the agent's current schema, like the rest of
  the conversation. The recorded revision is information for the reader that
  needs it: the review campaign reviewer shows a session's answers with the
  schema that collected them.
* **Content, not analytics.** The retention purge and session deletion drop
  the form rows. The session row keeps its statistics.
* **No schema copy.** Settings are versioned; the form points at a revision
  instead of duplicating the schema.

The `result` columns are gone. The migration creates one form per session
that had a state, attributed to the session's agent and stamped with the
revision of the session's last assistant message (or the agent's latest
published revision when the session has no message).

## 3. Consequences

* The fillForm tool no longer needs a per-surface "result updater": public
  and Studio sessions write to the same table. The public streaming proxy
  carries `persistsForms` instead of a `result` snapshot, and evaluation
  runs (no session row) set it to false and get no fillForm tool.
* Session DTOs expose `forms: ConversationFormDto[]` in place of `result`.
  The fronts pick the form of the agent they display.
* The handoff design (a sub-agent takes the conversation over inside the
  parent's session) can give each agent its own form in one session, show
  the parent every form of the conversation, and tell a sub-agent what
  earlier forms already know. None of that needs a schema change.

## 4. Alternatives Considered

* **Keep `result` and add a `forms` JSON list next to it.** Two places for
  the same thing, and no way to key the sub-agent's form by revision.
* **A generic `conversation_output` table with a `kind`.** Every reader
  (Studio sheet, reviewer panel, prompt) needs to know it is a form to render
  and validate it, so the kind would become a branch everywhere. A second
  kind of structured output, if one comes, gets its own table.
* **Copy the schema into the form.** Redundant with versioned settings; the
  revision id is enough and stays in sync with the messages.
