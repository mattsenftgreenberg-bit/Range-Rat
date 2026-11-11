# Range Rat

A hands-off golf management game. You sign golfers, train them, pick their events and watch them play: college, three professional tours, the senior circuit, then retirement into coaching.

## How it's put together

- `index.html` loads everything. There is no build step.
- `js/core.js` is the golf engine: courses, shots, tournaments, odds. It never touches the page.
- `js/game.js` is everything on screen: the stable, range work, events, the market, coaches, profiles and saving.
- `js/config.js` holds the public Supabase address and publishable key.
- `css/style.css` holds the look.
- `vendor/` holds a pinned copy of supabase-js.
- `supabase/migrations/` records every change made to the database.

## Saving

Careers always save in the browser. A signed-in player's career also saves to the `saves` table in Supabase, one row per player, protected by row-level security. Save codes on the Stable page are a manual backup.

## Hosting

Netlify publishes the repository root as is (`netlify.toml`).
