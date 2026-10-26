<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- This is the FREE version: no database, no server functions, no AI calls. Do not add Supabase tables, `createServerFn`, cron routes or AI gateways back.
- FEFI data is downloaded ONLY by `scripts/sync-fefi.mjs` (run daily by `.github/workflows/sync-fefi.yml`) into `public/data/matches.json`. The browser reads that file; never fetch fefi.com.ar from the app.
- A "team" is club + categoria; team identity is the `normalizeTeam()` key (src/lib/fefi-parse.ts), overridable via `scripts/team-aliases.json`.
- Stats and Poisson model live as pure code in `src/lib/predict.ts` (tested); `src/lib/local-api.ts` wires data to the UI; the commentary comes from fixed templates in `src/lib/relator.ts`.

- Derive the local equipos_actuales equivalent and zone levels in local-api.ts, preserving the free static-data architecture instead of querying Cloud tables.
- Pass category-filtered rows into predict.ts; the model merges annual tournaments and orders Clausura first.
- Keep previous commentary openings in UI state, not in the pure relator, to preserve seeded reproducibility.
