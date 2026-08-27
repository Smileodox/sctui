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
- By default sctui is **read-only by construction**: it only ever runs
  read-only `sc` commands. There is no code path that places, confirms or
  cancels an order, and none for "harmless" writes like watchlist edits
  either.
- The **single write feature** — creating savings plans — exists only behind
  `--enable-writes`, on a second exact-match allowlist holding exactly one
  command. The CLI itself forces it through a preview whose confirmation id
  must be echoed back, so nothing can be created that was not shown first.
  `--accept-unsuitable` (bypassing the broker's appropriateness check) is
  forbidden on every path.
- sctui sends no telemetry and writes nothing to disk. By default it opens
  no network connections of its own — its only effect on the outside world
  is invoking the `sc` binary. The single exception is the opt-in
  ETF-composition lookup (`--enable-lookup`): one external host
  (`query2.finance.yahoo.com`), and the only datum transmitted is the ISIN —
  never account data, positions or values. CI enforces this boundary the
  same way as the process boundary: `fetch` outside `src/lookup.ts` fails
  the build.

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
   step; the write variant calls `assertWrite()`, which additionally requires
   the runtime opt-in. [`tests/exec.test.ts`](tests/exec.test.ts) proves all
   of this on every CI run: path exactness on both allowlists, case
   sensitivity, flag forms, that the write gate stays closed without the
   opt-in, and that the search input can never be interpreted as a flag.

## Second layer: `--local-read-only`

You do not even have to trust this code. The official CLI can store the
session itself in read-only mode:

```sh
sc login --local-read-only
```

The `sc` binary then refuses any mutation — regardless of what a program
above it asks for. sctui recommends this login for read-only use; note that
the savings-plan wizard then cannot work either, because the binary refuses
the write. The allowlist is the second line of defence, not the only one.

## Scope of the guarantee

"Read-only by default" describes the release you are running, enforced by
the mechanisms above and their tests. The first write feature (savings-plan
creation, v0.4) landed exactly as this section always promised: opt-in via
`--enable-writes`, on a separate one-entry allowlist, previewed by the broker,
and visible in the same audit trail — one file, `src/sc/exec.ts`.

## Limits

- sctui shows what `sc` reports. Wrong, delayed or incomplete figures are
  possible — not investment advice; never act on this display alone.
- `npm install` pulls three runtime dependencies (ink, ink-text-input,
  react); the lockfile is committed. Provenance-attested publishing from CI
  is planned once npm trusted publishing is set up for the package.

## Found a vulnerability?

Please **not** as a public issue. Use GitHub's private vulnerability
reporting ("Report a vulnerability" in the repo's Security tab). Anything
touching the read-only guarantee is treated with the highest priority.
