# Range Rat: notes for Claude

- Owner: Matthew. He describes gameplay changes in plain words and tests in the browser; keep replies short and non-technical.
- The plan for the online version lives in the "Range Rat online plan" doc. This repository is Level 1 of it: the single-player game with accounts and cloud saves.
- Static site, no build step. Edit the files directly. `js/core.js` = engine (no DOM). `js/game.js` = UI and saving.
- Saved careers are JSON. Any change to their shape needs a migration step in `migrate()` / `up5()` in `js/game.js` so existing careers keep loading.
- Database changes go through a new file in `supabase/migrations/` and are applied to Supabase project `mqqshohxbwzrgtonresb`. Run the security advisor after each one.
- The Supabase publishable key in `js/config.js` is public by design. Never commit a secret or service-role key.
- Test with Playwright against a local server before pushing; check phone width (390px) for horizontal overflow.
