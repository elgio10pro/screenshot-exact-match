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
- FEFI data is scraped only by `src/lib/fefi-sync.server.ts` (button + daily cron route `/api/public/jobs/sync-fefi`); predictions always read from the `matches` table — never fetch fefi.com.ar per prediction.
- A "team" is club + categoria; team identity is `normalizeTeam()` key, overridable via `team_aliases`.
- Stats and Poisson model live as pure code in `src/lib/predict.ts` (tested); the AI only writes the explanation from those numbers.
