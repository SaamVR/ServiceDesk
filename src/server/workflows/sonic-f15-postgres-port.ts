import type {SupabaseRpcClient} from "../core/payment-application-postgres";
import type {F15AtomicEventCommand,F15AtomicIngressPort}
 from "./sonic-f15-atomic-ingress";

/**
 * F15 server-only future adapter. The PostgreSQL function named below is NOT
 * installed by this source PR. No route, cron, worker or Server Action
 * constructs this port. It must receive an explicitly authorized trusted
 * service-role RPC client after separate DBA/owner migration approval.
 *
 * Database function contract (future): lock and compare the saved request,
 * tenant/branch, version, last inbound, response-history completeness and
 * time-bound SLA against the CURRENT row; INSERT ON CONFLICT a unique
 * (workspace_id,branch_id,event_key) owner-review-only journal record;
 * return all receipt assertions in one transaction. Do not accept these
 * assertions from a client-controlled request.
 */
export const F15_ATOMIC_RPC = "servicedesk_claim_f15_unanswered_lead_sla_review" as const;

export class PostgresF15AtomicIngressPort implements F15AtomicIngressPort {
  constructor(private readonly authorizedBackend: Pick<SupabaseRpcClient,"rpc">) {}

  async claimVerifiedEvent(command: Readonly<F15AtomicEventCommand>): Promise<unknown> {
    // Explicit narrow allowlist: no arbitrary request text, email, customer
    // contact, provider token, action body or money enters the RPC.
    const p_input = {
      workspaceId:command.workspaceId,
      branchId:command.branchId,
      requestId:command.requestId,
      sourceVersion:command.sourceVersion,
      sourceLastInboundAt:command.sourceLastInboundAt,
      eventType:command.eventType,
      eventKey:command.eventKey,
      observedAt:command.observedAt,
      dueAt:command.dueAt,
      thresholdMinutes:command.thresholdMinutes,
      transactionalSourceRecheckRequired:command.transactionalSourceRecheckRequired,
      uniqueEventKeyRequired:command.uniqueEventKeyRequired,
      requiresOwnerReview:command.requiresOwnerReview,
      customerMessageAuthorized:command.customerMessageAuthorized,
      financialMutationAuthorized:command.financialMutationAuthorized,
    };
    // The RPC is not present in the current approved database. Any missing
    // migration, permission denial or connection error remains an exception
    // and will be reported by the outer ingress as UNAVAILABLE, not success.
    const {data,error} = await this.authorizedBackend.rpc<unknown>(
      F15_ATOMIC_RPC,{p_input},
    );
    if (error || !data) throw Error("F15_ATOMIC_DB_RPC_NOT_AVAILABLE");
    return data;
  }
}
