# Verification

## Commands

```sh
npm ci              # clean-checkout install
npm run typecheck   # tsc --noEmit, whole repo
npm test            # every src/**/*.test.ts via node --test
npm run web:smoke   # non-interactive `expo export --platform web`
```

CI (`.github/workflows/ci.yml`) runs all four on every push to `main` and every PR.

## `.env` files: PATH does not go in `.env`

Expo CLI refuses to load any `.env` file that defines `PATH`:

```
Error: Refused to load dangerous environment variables from .env files.
```

`.env` is auto-scanned by every `expo`/`npx expo` command in this project, so a `PATH`
line there breaks local Expo usage entirely (`expo start`, `expo install`, `expo export`,
etc. all fail immediately).

`scripts/dispatcher.sh` (the agent-team cron heartbeat) needs a `PATH` override to find
`claude`/`jq`/`gh` under cron's minimal environment. That value lives in a separate file,
`.env.dispatcher-path` (gitignored, copy from `.env.dispatcher-path.example`), which
`dispatcher.sh` sources in addition to `.env`. Expo never scans this filename, so the two
concerns don't collide.

If you ever see the "Refused to load dangerous environment variables" error again, check
`.env` for a `PATH` line and move it to `.env.dispatcher-path` instead.
