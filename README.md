# Range Rat

A hands-off golf management game. You sign golfers, train them, pick their events and watch them play: college, three professional tours, the senior circuit, then retirement into coaching.

The main site is one **shared world**: every manager's golfers play in the same timed events on weeknight evenings (6 to 10pm New York time), and one season is one calendar month. The original single-player game lives on at `/solo`.

## How it's put together

- `index.html` + `js/online.js`: the shared-world game. It reads the database directly (read-only) and sends every action to the `game` server function.
- `solo/index.html` + `js/game.js`: the single-player game with cloud saves (the `saves` table).
- `js/core.js` is the golf engine: courses, shots, tournaments, odds. It never touches the page. The server uses the same engine: run `tools/sync-engine.sh` after changing it.
- `supabase/functions/clock`: the world's timekeeper. pg_cron calls it every 20 seconds. It sets the season schedule, closes entries and builds fields, plays rounds (kept hidden and revealed hole by hole on the clock), pays out, runs the midnight refresh and closes each month's season.
- `supabase/functions/game`: every player action (scouting, signing, training, coaching, entries, the market, retirement, admin settings and test events).
- Deployed functions are thin wrappers that import the source from this repository at a pinned commit, so redeploying means pushing, then redeploying the wrapper with the new commit.
- `supabase/migrations/` records every change made to the database.
- `js/config.js` holds the public Supabase address and publishable key. `css/style.css` holds the look. `vendor/` holds a pinned copy of supabase-js.

## Fair play

Players can read the tables but never write to them. Scores are revealed by `event_board()` and `event_watch()` only as each hole is reached on the clock; ceilings, coaching talent and the scouted prospect live in tables players can't read.

## Hosting

Netlify publishes the repository root as is (`netlify.toml`).
