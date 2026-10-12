import { handleInternalQuoteSourceWorkerPost } from "@/server/workflows/customer-quote-source-worker-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// No GET handler and no cron schedule: activation requires a separate,
// explicit operator-reviewed scheduler and SQL 0062 migration.
export async function POST(request: Request): Promise<Response> {
  return handleInternalQuoteSourceWorkerPost(request);
}
