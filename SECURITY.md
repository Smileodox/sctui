# Security

sctui displays portfolio data. Using it means giving a third-party program
access to your Scalable CLI session — this document explains why that is
reasonable and how to **verify it yourself in five minutes** instead of
taking it on faith.

## Trust model

- sctui holds **no credentials of its own** and talks to **no API**.
  Everything goes through the official
  [`sc` CLI](https://github.com/ScalableCapital/scalable-cli), which you
  install and log into yourself. Tokens are managed by `sc`, not by sctui.
- The current release is **read-only by construction**: it only ever runs
  read-only `sc` commands. There is no code path that places, confirms or
  cancels an order, and none for "harmless" writes like watchlist edits
  either.
- sctui sends no telemetry, writes nothing to disk and opens no network
  connections. Its only effect on the outside world is invoking the `sc`
  binary.

## The five-minute audit

The guarantee hangs on exactly one file. To check it:

1. **One choke point.** Processes are spawned exclusively in
   [`src/sc/exec.ts`](src/sc/exec.ts):

   ```sh
   grep -rn child_process src/
   # → exactly one hit: src/sc/exec.ts
   ```

   CI enforces this:
   [`scripts/check-readonly-boundary.mjs`](scripts/check-readonly-boundary.mjs)
   fails as soon as `child_process` appears anywhere else in `src/`.

2. **One allowlist.** `READ_ONLY_COMMANDS` in `exec.ts` lists every permitted
   command as an **exact** token path — no prefix matching, i.e.
   `broker watchlist` does not permit `broker watchlist add`.

3. **One blocklist.** `FORBIDDEN_FLAGS` rejects confirmation flags
   (`--confirm`, `--accept-unsuitable`, `--yes`, `-y`), including the
   `--flag=value` form — conservatively: a blocked flag is refused even when
   it only appears as a value.

4. **Before every spawn.** `runSc()` calls `assertReadOnly()` as its first
   step. [`tests/exec.test.ts`](tests/exec.test.ts) proves all of this on
   every CI run: path exactness, case sensitivity, flag forms, and that the
   search input can never be interpreted as a flag.

## Second layer: `--local-read-only`

You do not even have to trust this code. The official CLI can store the
session itself in read-only mode:

```sh
sc login --local-read-only
```

The `sc` binary then refuses any mutation — regardless of what a program
above it asks for. sctui recommends this login, and its current version never
issues anything such a session would refuse. The allowlist is the second line
of defence, not the only one.

## Scope of the guarantee

"Read-only" describes the release you are running, enforced by the mechanisms
above and their tests — it is not a promise about all future versions. If
write features ever land, they will be opt-in, separately guarded, and
released clearly as such; the audit trail above will make any such change
visible in one file.

## Limits

- sctui shows what `sc` reports. Wrong, delayed or incomplete figures are
  possible — not investment advice; never act on this display alone.
- `npm install` pulls three runtime dependencies (ink, ink-text-input,
  react); the lockfile is committed and releases are published with
  `npm publish --provenance`.

## Found a vulnerability?

Please **not** as a public issue. Use GitHub's private vulnerability
reporting ("Report a vulnerability" in the repo's Security tab). Anything
touching the read-only guarantee is treated with the highest priority.
