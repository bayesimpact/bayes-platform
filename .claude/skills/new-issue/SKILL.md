---
name: new-issue
description: Create a GitHub issue on bayesimpact/bayes-platform from a free-text description. Drafts a clear title and structured body, picks appropriate labels, and posts it via the gh CLI, returning the issue URL. Optionally enriches the issue with context from the current codebase.
user_invocable: true
---

Turn a free-text description into a well-formed GitHub issue and post it.

## ⚠️ Guardrail: bayes-platform is PUBLIC

`bayesimpact/bayes-platform` is a **public** repository. Anything posted there (titles, bodies, comments, labels) is world-readable.

- **NEVER mention the "Health" project** — or anything that identifies it — in any issue, body, or comment on bayes-platform. Strip it from the user's description and rephrase in neutral, generic terms.
- More broadly, never include client names, confidential project names, internal URLs, credentials, or private data in anything posted to a public repo.
- If the user's description leans on a confidential detail to make sense, genericize it (e.g. "a specific client deployment") rather than dropping the issue. If you cannot genericize it without losing the point, STOP and ask the user how to phrase it.

This guardrail overrides "Friction is the enemy" — when confidentiality is at stake, pause and check rather than post.

## Target repository

Default repo: `bayesimpact/bayes-platform`.

Override only if the user explicitly names another repo in the invocation (e.g. `/new-issue --repo owner/name ...` or "sur le repo X"). Otherwise always use the default — do NOT infer the repo from the current working directory.

## Inputs

The arguments are the raw description of the issue, in any language, however terse (e.g. `/new-issue le bouton upload plante au-delà de 10Mo`). There is no fixed format — interpret intent.

If the arguments are empty, ask the user for a one-line description before doing anything else.

## Steps

1. **Always write the issue in English.** Regardless of the language the user used in their description (they typically write in French), the title AND body of the issue must be written in English. Translate the user's intent into clear, natural English — do not transliterate.

2. **Check for an existing issue first (avoid duplicates).** Before drafting anything, search the target repo for open AND closed issues that might already cover this. Derive 2–3 keyword queries from the user's description (e.g. a symbol name, the feature noun) and run:

   ```bash
   gh issue list --repo <repo> --state all --search "<keywords>" --limit 10 \
     --json number,title,state,url
   ```

   Judge matches by meaning, not exact wording. Then:
   - **Likely duplicate found** → STOP. Do not create. Show the candidate(s) as a clickable link with title and state, and ask the user whether they want to (a) skip, (b) comment on the existing issue (`gh issue comment <number> --repo <repo> --body ...`), (c) reopen it if closed (`gh issue reopen <number>`), or (d) create a new one anyway.
   - **No clear match** → proceed to draft and create as usual. Optionally mention in one line that you checked and found none.

   A closed issue that matches is still worth surfacing — the problem may have regressed or been previously declined.

3. **Draft the title.** Concise, specific, imperative or descriptive — no trailing period. Good: "Upload PDF échoue au-delà de 10 Mo". Bad: "bug upload".

4. **Draft the body** using this structure, omitting any section that would be empty rather than padding it:

   ```markdown
   ## Context
   <1-2 sentences: what/where, in the user's words, cleaned up>

   ## Expected behavior
   <only if it's a bug or a behavior change>

   ## Current behavior
   <only if it's a bug>

   ## Notes
   <optional: any leads, file references, reproduction steps the user gave>
   ```

   For a feature/enhancement, use `## Context`, `## Proposal`, and optional `## Notes` instead.

5. **Enrich with codebase context — only when clearly relevant.** If the description points at code in the *current* working directory (a file, component, symbol, error message), you may search the repo and add concrete `path/to/file.ts:42` references under "Notes". Keep it light; do not over-investigate. Skip entirely if the issue is about bayes-platform but you're in a different repo — never reference unrelated code.

6. **Pick labels** from the repo's available set (fetch with `gh label list --repo <repo>` if unsure). The standard set is: `bug`, `enhancement`, `documentation`, `question`, `security`, `good first issue`, `help wanted`, `duplicate`, `invalid`, `wontfix`. Apply 1–2 that genuinely fit (usually just `bug` or `enhancement`). Do not invent labels. If none clearly fit, apply none.

7. **Create the issue** with the gh CLI. Use a heredoc for the body to preserve formatting:

   ```bash
   gh issue create \
     --repo bayesimpact/bayes-platform \
     --title "<title>" \
     --label "<label>" \
     --assignee @me \
     --body "$(cat <<'EOF'
   <body>
   EOF
   )"
   ```

   - Multiple labels: repeat `--label` per label.
   - **Always assign the issue to the user** with `--assignee @me` by default. Only omit it if the user explicitly asks not to be assigned, or names a different assignee (then use `--assignee <login>`).

8. **Report** the created issue URL (gh prints it) as a clickable link, plus a one-line summary of the title and labels applied.

## Friction is the enemy

This skill exists because creating issues through the GitHub web UI is tedious. Favor speed: when the description is clear enough, draft and post directly, then show the URL — the user can refine the issue on GitHub or ask you to edit it. Only pause to ask a clarifying question when the description is genuinely too ambiguous to title (e.g. a single vague word). Never make the user fill out a form.

## After posting

If the user wants changes, edit in place rather than creating a new issue:
- Title/body: `gh issue edit <number> --repo <repo> --title ... --body ...`
- Labels: `gh issue edit <number> --repo <repo> --add-label ... --remove-label ...`
- Close: `gh issue close <number> --repo <repo>`
