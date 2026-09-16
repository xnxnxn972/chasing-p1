---
description: Rebuild the Chasing P1 analytics dashboard from live Supabase data and republish it to the same Artifact URL
argument-hint: "[optional focus, e.g. 'sources' or 'retention']"
allowed-tools: Bash, Read, Artifact
---

Refresh the Chasing P1 analytics dashboard and republish it.

## Steps

1. Build it. The repo lives at `C:/Users/yaniv/OneDrive/Projects/chasing-p1`,
   which may not be the session's working directory — cd there explicitly:

   ```
   cd /c/Users/yaniv/OneDrive/Projects/chasing-p1 && npm run dashboard
   ```

   The admin token is read from `.cp1-token` in the repo root — gitignored,
   because this repository is PUBLIC and that token reads the whole session
   log including the names players typed in. If the build reports no token,
   stop and tell the user to fetch it with
   `select token from public.cp_admin where id = 1;` rather than guessing.

   The command prints a line like
   `fetched N rows (... pre-post, ... dev) -> N careers, N visits`.
   If it reports truncation, say so — a silent row cap has bitten this
   project three times and the on-page banner exists because of it.

2. Read `dashboard.data.json` for the numbers you are about to describe.
   Do not describe numbers you have not read.

3. Publish `dashboard.html` to the EXISTING artifact, in place:

   - URL: https://claude.ai/artifact/FvvxSNd9h2j9pmHZpLDwTF
   - Read it first (`action: "read"` with that url) if this conversation has
     not already read or published it, otherwise the publish is refused.
   - Pass that url as `url` so it updates rather than creating a second
     dashboard. A new URL every refresh is the failure mode here.
   - Give the publish a short `label` marking the moment, e.g. "Day 4 morning".

4. Report to the user, briefly:

   - headline totals (careers, visits, finish rate, hours played)
   - the change since the previous version, not just the absolute numbers
   - anything genuinely new: a traffic source that did not exist before, a
     day's decay breaking its trend, a first `pwa` or `share` arrival
   - if $ARGUMENTS names a focus, lead with that

## Rules

- NEVER `git add` `dashboard.html` or `dashboard.data.json`. Both are
  gitignored and both pair player-entered names with geolocated countries.
- Do not deploy the game, run migrations, or touch `src/` — this command
  refreshes a report and nothing else.
- Small numbers are small. Say "1 visit" is noise when it is, rather than
  narrating it as a trend.
