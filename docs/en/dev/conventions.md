# Development conventions

Before changing code or documentation, please follow these conventions.

## Code style

- **4-space indentation** (ESLint `@stylistic/indent` + `vue/html-indent`);
- Run `npm run lint` before committing (0 errors; existing warnings can be ignored);
- TypeScript strict mode; type-check with `npm run typecheck`.

## Comments

- Comment language: **concise Chinese**;
- Functions / methods / exported APIs: use **short Chinese JSDoc** (`/** ... */`), one sentence saying what it does, adding `@param` / `@returns` only when necessary;
- Inline comments **keep it brief**: only where something is non-obvious or a known pitfall, never line-by-line explanations.

## Files and directories

| Convention | Location |
|---|---|
| Temporary / intermediate files (logs, reports, drafts) | `.temp/` at the workspace root, deleted once used |
| AI-assistance files (index, onboarding docs) | `.dsh/` at the workspace root |
| Do not scatter temp files | No temp artifacts in the workspace root, `project/` or `docs/` |

`.dsh/` and `.temp/` are not version-controlled beyond the docs site and the index.

## Git and remotes

- Local operations (`add` / `commit` / `branch` / `merge` / `checkout`) can be performed directly;
- **Pushing to the remote always requires confirmation**: any `git push` (regular, `--force`, `--tags`, deleting a remote branch / tag, moving a tag) must first state the target and get approval; never push automatically;
- Destructive remote operations (force-push, deleting a remote branch / tag) especially require confirmation first.

## Documentation

- In-site links carry a language prefix (`/zh/...` or `/en/...`) and a category (`/user/` or `/dev/`);
- Chinese and English pages exist **in pairs**;
- Describe files in the workspace with relative paths.

## No test suite

This repository has no automated tests; verification is based on `typecheck` / `lint` / `build`; for runtime behavior, verify manually or with a script and explain how.
