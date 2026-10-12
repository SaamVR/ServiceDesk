import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseRpcClient } from "@/server/core/payment-application-postgres";
import {
  runTrustedAcceptedQuoteInternalAutomation,
} from "./customer-quote-accepted-bridge";

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const validWorker = (value: string) => /^[A-Za-z0-9_-]{8,80}$/.test(value);
type Outcome = "SUCCEEDED" | "FAILED" | "SKIPPED";
interface SourceEvent {
  id: string;
  workspace_id: string;
  quote_id: string;
  event_type: "QUOTE_ACCEPTED";
  state: "PROCESSING";
}
export interface InternalSourceRecoverySummary {
  state: "NO_DEPLOYMENT_OPT_IN" | "BATCH_PROCESSED" | "CLAIM_UNVERIFIED";
  claimed: number;
  completed: number;
  retryPending: number;
  deadLetter: number;
  skipped: number;
  completionNotVerified: number;
  providerMessagesSent: 0;
}
export interface InternalSourceWorkerPorts {
  service: SupabaseClient;
  rpc: SupabaseRpcClient;
  workerId: string;
  maxBatch?: number;
}
/** Injector for deterministic, real database-independent crash/replay tests. */
export interface InternalSourceWorkerDependencies {
  enabled?: () => boolean;
  bridge?: typeof runTrustedAcceptedQuoteInternalAutomation;
}

const safeError = (code: unknown): string =>
  typeof code === "string" && /^[A-Z0-9_]{1,80}$/.test(code)
    ? code : "QUOTE_SOURCE_RECOVERY_UNVERIFIED";

/**
 * Only an explicitly trusted server scheduler may supply these privileged
 * service-role ports. No public endpoint, user token or provider send exists.
 * Never activate this worker until SQL 0062 and owner staging approval pass.
 */
export async function runInternalQuoteSourceRecoveryBatch(
  ports: InternalSourceWorkerPorts,
  deps: InternalSourceWorkerDependencies = {},
): Promise<InternalSourceRecoverySummary> {
  const summary: InternalSourceRecoverySummary = {
    state: "CLAIM_UNVERIFIED", claimed: 0, completed: 0, retryPending: 0,
    deadLetter: 0, skipped: 0, completionNotVerified: 0, providerMessagesSent: 0,
  };
  const enabled = deps.enabled ?? (() =>
    process.env.SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED === "true");
  if (!enabled()) return { ...summary, state: "NO_DEPLOYMENT_OPT_IN" };
  if (!validWorker(ports.workerId)) return summary;
  const limit = Math.min(25, Math.max(1,
    Number.isSafeInteger(ports.maxBatch) ? ports.maxBatch! : 10));
  let claim: Awaited<ReturnType<typeof ports.rpc.rpc>>;
  try {
    claim = await ports.rpc.rpc("servicedesk_claim_quote_source_events",
      { p_worker: ports.workerId, p_limit: limit });
  } catch {
    return summary;
  }
  if (claim.error || !Array.isArray(claim.data) || claim.data.length > limit) {
    return summary;
  }
  summary.state = "BATCH_PROCESSED";
  const seen = new Set<string>();
  for (const raw of claim.data) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      summary.completionNotVerified++;
      continue;
    }
    const row = raw as Record<string, unknown>;
    const id = row.id;
    const workspaceId = row.workspace_id;
    const quoteId = row.quote_id;
    if (!isUuid(id) || !isUuid(workspaceId) || !isUuid(quoteId) ||
        seen.has(id) || row.event_type !== "QUOTE_ACCEPTED" ||
        row.state !== "PROCESSING") {
      summary.completionNotVerified++;
      continue;
    }
    seen.add(id);
    summary.claimed++;
    let outcome: Outcome = "FAILED";
    let errorCode = "QUOTE_SOURCE_RECOVERY_UNVERIFIED";
    try {
      const quote = await ports.service.from("quotes")
        .select("id,workspace_id,request_id,status")
        .eq("workspace_id", workspaceId).eq("id", quoteId).maybeSingle();
      if (quote.error || quote.data?.status !== "ACCEPTED" ||
          !isUuid(quote.data?.request_id) ||
          quote.data?.workspace_id !== workspaceId ||
          quote.data?.id !== quoteId) {
        errorCode = "QUOTE_SOURCE_ACCEPTED_FACT_UNVERIFIED";
      } else {
        const request = await ports.service.from("requests")
          .select("id,workspace_id,customer_id")
          .eq("workspace_id", workspaceId).eq("id", quote.data.request_id)
          .maybeSingle();
        if (request.error || !request.data || !isUuid(request.data.customer_id) ||
            request.data.workspace_id !== workspaceId ||
            request.data.id !== quote.data.request_id) {
          errorCode = "QUOTE_SOURCE_CUSTOMER_UNVERIFIED";
        } else {
          const result = await (deps.bridge ?? runTrustedAcceptedQuoteInternalAutomation)({
            workspaceId, customerId: request.data.customer_id,
            quoteId, service: ports.service, rpc: ports.rpc,
          });
          if (result.ok && result.value.providerMessagesSent === 0) {
            outcome = "SUCCEEDED";
          } else if (!result.ok && result.code === "QUOTE_AUTOMATION_WORKSPACE_NOT_OPTED_IN") {
            // An owner disabled the tenant after the event was recorded.
            outcome = "SKIPPED";
          } else {
            errorCode = result.ok
              ? "QUOTE_SOURCE_PROVIDER_RESULT_INVALID"
              : safeError(result.code);
          }
        }
      }
    } catch {
      errorCode = "QUOTE_SOURCE_REPLAY_EXCEPTION";
    }
    try {
      const completion = await ports.rpc.rpc("servicedesk_complete_quote_source_event",{
        p_id:id,p_worker:ports.workerId,p_outcome:outcome,
        p_error_code:outcome==="FAILED"?errorCode:null,
      });
      const confirmed = completion.data;
      const record = confirmed && typeof confirmed === "object" && !Array.isArray(confirmed)
        ? confirmed as Record<string,unknown> : undefined;
      const state = record?.state;
      const validState = outcome === "SUCCEEDED" ? state === "SUCCEEDED"
        : outcome === "SKIPPED" ? state === "SKIPPED"
        : state === "RETRY_PENDING" || state === "DEAD_LETTER";
      if (completion.error || record?.ok !== true || !validState) {
        summary.completionNotVerified++;
      } else if (state === "SUCCEEDED") summary.completed++;
      else if (state === "SKIPPED") summary.skipped++;
      else if (state === "DEAD_LETTER") summary.deadLetter++;
      else summary.retryPending++;
    } catch {
      summary.completionNotVerified++;
    }
  }
  return summary;
}
