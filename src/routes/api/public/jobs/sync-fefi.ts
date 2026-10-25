import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { runNextSyncUnit } from "@/lib/fefi-sync.server";

// Each call refreshes the next few blocks (one zona's Apertura/Clausura each) in rotation.
export const Route = createFileRoute("/api/public/jobs/sync-fefi")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        try {
          return Response.json({ success: true, ...(await runNextSyncUnit()) });
        } catch (e) {
          return Response.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
