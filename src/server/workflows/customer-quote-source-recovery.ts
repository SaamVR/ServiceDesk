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

/** A database RPC response is still an untrusted transport boundary.
 * Never call iterator/getters/proxy methods while evaluating lease authority.
 * Additional ordinary SQL columns are allowed; non-data descriptors are not.
 */
function inertSourceRecord(value: unknown): value is Record<string,unknown> {
  try {
    return !!value && typeof value==="object" && !Array.isArray(value) &&
      Object.getPrototypeOf(value)===Object.prototype &&
      Reflect.ownKeys(value).length===Object.keys(value).length &&
      Object.values(Object.getOwnPropertyDescriptors(value))
        .every(d=>Object.hasOwn(d,"value"));
  } catch {return false;}
}
function captureClaimRows(value:unknown,limit:number):Record<string,unknown>[]|null{
  try {
    if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)
      return null;
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const length=descriptors.length?.value;
    if(!Number.isSafeInteger(length)||length<0||length>limit||
       Reflect.ownKeys(value).length!==length+1) return null;
    const records:Record<string,unknown>[]=[];
    for(let i=0;i<length;i++){
      const item=descriptors[String(i)];
      if(!item||!Object.hasOwn(item,"value")||
         !inertSourceRecord(item.value))return null;
      records.push(item.value);
    }
    return records;
  }catch{return null;}
}

/**
 * Only an explicitly trusted server scheduler may supply these privileged
 * service-role ports. No public endpoint, user token or provider send exists.
 * Never activate this worker until SQL 0063 and owner staging approval pass.
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
  // Validate and snapshot the WHOLE claim before the first internal side
  // effect. A proxy iterator or hidden event row must not partially dispatch.
  const sourceRows=claim.error?null:captureClaimRows(claim.data,limit);
  if (!sourceRows) return summary;
  summary.state = "BATCH_PROCESSED";
  const seen = new Set<string>();
  for (const row of sourceRows) {
    const id = row.id;
    const workspaceId = row.workspace_id;
    const quoteId = row.quote_id;
    // A well-formed RPC response is not sufficient. The worker must prove
    // it still owns an unexpired lease before creating any side effect.
    const leaseUntil = typeof row.locked_until === "string"
      ? Date.parse(row.locked_until) : NaN;
    if (!isUuid(id) || !isUuid(workspaceId) || !isUuid(quoteId) ||
        seen.has(id) || row.event_type !== "QUOTE_ACCEPTED" ||
        row.state !== "PROCESSING" ||
        row.locked_by !== ports.workerId ||
        !Number.isFinite(leaseUntil) || leaseUntil <= Date.now() ||
        !Number.isSafeInteger(row.attempts) || (row.attempts as number) < 1 ||
        (row.attempts as number) > 8) {
      summary.completionNotVerified++;
      continue;
    }
    seen.add(id);
    summary.claimed++;
    let outcome: Outcome = "FAILED";
    let errorCode = "QUOTE_SOURCE_RECOVERY_UNVERIFIED";
    try {
      const quote = await ports.service.from("quotes")
        .select("id,workspace_id,request_id,status,accepted_at,superseded_by")
        .eq("workspace_id", workspaceId).eq("id", quoteId).maybeSingle();
      if (quote.error || !quote.data ||
          quote.data.status !== "ACCEPTED" ||
          !isUuid(quote.data.request_id) ||
          quote.data.workspace_id !== workspaceId ||
          quote.data.id !== quoteId ||
          typeof quote.data.accepted_at !== "string" ||
          !Number.isFinite(Date.parse(quote.data.accepted_at))) {
        errorCode = "QUOTE_SOURCE_ACCEPTED_FACT_UNVERIFIED";
      } else if (isUuid(quote.data.superseded_by)) {
        // A formerly accepted quote has since been replaced. Its durable
        // journal receipt must be terminally skipped, not retried into a
        // new internal workflow or mistaken for a completed automation.
        outcome = "SKIPPED";
      } else if (quote.data.superseded_by !== null) {
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
          // The initial claim is a snapshot: slow quote/customer reads can
          // consume its TTL. Re-read the *current* service-only lease before
          // any internal attention write, rejecting reassignment and expiry.
          // This reduces stale-worker races; DB-side idempotency remains the
          // final guard if the lease expires after this read.
          const liveLease = await ports.service.from("workflow_source_events")
            .select("id,workspace_id,quote_id,event_type,state,locked_by,locked_until,attempts")
            .eq("workspace_id",workspaceId).eq("id",id).maybeSingle();
          const live = liveLease.data;
          const currentUntil = typeof live?.locked_until === "string"
            ? Date.parse(live.locked_until) : NaN;
          if (liveLease.error || !live ||
              live.id !== id || live.workspace_id !== workspaceId ||
              live.quote_id !== quoteId || live.event_type !== "QUOTE_ACCEPTED" ||
              live.state !== "PROCESSING" ||
              live.locked_by !== ports.workerId ||
              live.attempts !== row.attempts ||
              !Number.isFinite(currentUntil) || currentUntil <= Date.now()) {
            errorCode = "QUOTE_SOURCE_LEASE_REVALIDATION_FAILED";
          } else {
            const result = await (deps.bridge ?? runTrustedAcceptedQuoteInternalAutomation)({
              workspaceId, customerId: request.data.customer_id,
              quoteId, service: ports.service, rpc: ports.rpc,
            });
            // The journal cannot ACK on a bare ok flag, a plausible text
            // answer, or a zero-provider-send claim. Validate the actual
            // persisted internal bridge receipt including bounded counters.
            const receipt = result.ok ? result.value : null;
            const count = (value: unknown) =>
              typeof value === "number" && Number.isSafeInteger(value) &&
              value >= 0 && value <= 1000;
            const receiptVerified = receipt &&
              receipt.state === "PERSISTED_INTERNAL_QUOTE_ACCEPTED_AUTOMATION" &&
              receipt.providerMessagesSent === 0 &&
              count(receipt.newlyRecordedRuleExecutions) &&
              count(receipt.reusedRuleExecutions) &&
              receipt.newlyRecordedRuleExecutions + receipt.reusedRuleExecutions > 0 &&
              count(receipt.completedAttentionActions) &&
              count(receipt.approvalRequired);
            if (result.ok && receiptVerified) {
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
      const record = inertSourceRecord(confirmed) ? confirmed : undefined;
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
