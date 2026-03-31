---
name: pr
description: Commit, verify build, push, and optionally create a PR. Use when you want to ship current changes.
---

# Ship Changes Workflow

Follow these steps in order. Do not skip build verification.

## Steps

1. **Check status**: Run `git status` and `git diff --stat` to see changes. If nothing to commit, tell the user and stop.

2. **Stage and commit**: Stage relevant files (avoid `.env*`, credentials). Commit with a short, imperative message. Always include:
   ```
   Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
   ```

3. **Sync with main**: Run `git pull origin main --rebase`. If conflicts, resolve, stage, and continue rebase.

4. **Type check**: Run `npx tsc --noEmit`. Fix errors before proceeding.

5. **Build check**: Run `npm run build`. Fix errors before proceeding.

6. **Push**: 
   - If on `main`: `git push`
   - If on a branch: `git push -u origin HEAD`

7. **PR (if on a branch)**: Run `gh pr create --fill` or with `--title`/`--body`. Report the PR URL.

8. **Skip PR (if on main)**: Vercel auto-deploys from main. Confirm push succeeded and report the commit hash.

## Rules

- Never skip steps 4 and 5. Build verification is mandatory.
- If any step fails, fix the issue before moving to the next step.
- Never push code that doesn't build.
- If env vars were added/changed, remind user that a redeploy may be needed (`vercel --prod`).
