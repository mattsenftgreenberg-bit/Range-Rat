# Range Rat: notes for Claude

- Owner: Matthew. He describes gameplay changes in plain words and tests in the browser; keep replies short and non-technical.
- The plan for the online version lives in the "Range Rat online plan" doc. This repository is Level 2 of it: the shared world at `/`, with the Level 1 single-player game kept at `/solo`.
- Static site, no build step. Edit the files directly. `js/core.js` = engine (no DOM). `js/online.js` = shared-world UI. `js/game.js` = solo UI and saving.
- `js/online.js` starts with helper lines copied from the top of `js/game.js`; keep them in step.
- Solo saved careers are JSON. Any change to their shape needs a migration step in `migrate()` / `up5()` in `js/game.js` so existing careers keep loading.
- Server logic is in `supabase/functions/` (`clock` and `game`, sharing `_shared/`). After changing `js/core.js`, run `tools/sync-engine.sh`. Deployed functions are wrappers importing the source from GitHub at a pinned commit: push, then redeploy each wrapper with the new commit hash (`verify_jwt` off; they check auth themselves).
- Gameplay numbers the admin can change live in `DEFAULTS` in `_shared/common.ts` and are mirrored in `js/online.js`.
- Database changes go through a new file in `supabase/migrations/` and are applied to Supabase project `mqqshohxbwzrgtonresb`. Run the security advisor after each one.
- The Supabase publishable key in `js/config.js` is public by design. Never commit a secret or service-role key.
- Test with Playwright against a local server before pushing; check phone width (390px) for horizontal overflow.
