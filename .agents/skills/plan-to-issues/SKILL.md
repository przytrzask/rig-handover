---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Ask the human what every issue here must carry (fields, labels, wording), unless it is
   already written down in this session or in the repo. What every issue here carries:
   - First line: `Source: plan.md § <n>` (the plan section it comes from; `§ 2a` for a sub-part).
   - The label `plan:<plan>` from the plan's frontmatter (e.g. `plan:morning-digest`). Create it
     once: `gh label create "plan:<plan>"`.
   - Sections: Scope · Done when (copied from the plan) · Blocked by (issue numbers) · Worker
     (strongest model for logic, cheaper for views and tests).
   - A step that waits on someone else (a reviewer, a host, a person) says so in "Blocked by" and
     "Done when". It stays open until that happens, and the clean-up after it is blocked by it.
5. Create each issue in dependency order, so blocked-by can cite real numbers:

   ```sh
   gh issue create --title "<title>" --body-file <tmp.md>
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

Close only when its "Done when" holds on the default branch. A commit with `closes #n` pushed to
the default branch closes the issue without the closing comment: post the comment first, or keep
`closes #n` out of the message and close by hand.

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
