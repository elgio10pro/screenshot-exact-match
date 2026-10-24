import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { runFefiSync } from "@/lib/fefi-sync.server";

export const Route = createFileRoute("/api/public/jobs/sync-fefi")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        try {
          const r = await runFefiSync();
          return Response.json({ success: true, ...r });
        } catch (e) {
          return Response.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
