import type { ClaimedOutboxEvent } from "../../../contracts/outbox";
import type { Result } from "../../../contracts";
import type { OutboxJob, DeliveryChannel, DeliveryPurpose } from "../types";

export interface OutboxDeliveryIntentResolver {
  resolve(event: ClaimedOutboxEvent): Promise<Result<OutboxJob>>;
}
const channels=new Set<DeliveryChannel>(["WHATSAPP","EMAIL","WEBHOOK","GOOGLE_CALENDAR"]);
const purposes=new Set<DeliveryPurpose>(["QUOTE","CONFIRMATION","REMINDER","INVOICE",
  "FEEDBACK","STAFF_ALERT","CUSTOMER_REPLY","CALENDAR_VISIT","VISIT_REMINDER","RETENTION_CAMPAIGN"]);
const safeIdentity=(v:unknown,max=256):v is string=>typeof v==="string"&&
  v.length>0&&v.length<=max&&v.trim()===v&&
  !/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/iu.test(v);
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
function failure(code:string,message:string):Result<OutboxJob>{return {ok:false,code,message};}

/** Validate *resolved* trusted DB intent before consent handling/dispatch.
 * Resolver adapters cannot substitute another workspace/recipient or launder
 * opaque provider identifiers into a customer send on a successfully claimed
 * outbox event. The dispatcher independently repeats these checks.
 */
export function validateResolvedOutboxJob(event:ClaimedOutboxEvent,job:OutboxJob):Result<OutboxJob>{
  if(!record(event)||!record(job)||
     !safeIdentity(event.id)||!safeIdentity(event.workspaceId)||
     !safeIdentity(event.idempotencyKey)||
     !safeIdentity(job.id)||!safeIdentity(job.workspaceId)||
     !safeIdentity(job.idempotencyKey)){
    return failure("OUTBOX_INTENT_IDENTITY_INVALID","Resolved outbox job has invalid claim identity.");
  }
  if(job.id!==event.id)return failure("OUTBOX_INTENT_ID_MISMATCH","Resolved outbox job id does not match the claimed event id.");
  if(job.workspaceId!==event.workspaceId)return failure("OUTBOX_INTENT_WORKSPACE_MISMATCH","Resolved outbox job workspace does not match the claimed event workspace.");
  if(job.idempotencyKey!==event.idempotencyKey)return failure("OUTBOX_INTENT_IDEMPOTENCY_MISMATCH","Resolved outbox job idempotency key does not match the claimed event idempotency key.");
  if(!channels.has(job.channel))return failure("OUTBOX_INTENT_CHANNEL_INVALID","Resolved outbox job channel is unsupported.");
  if(!purposes.has(job.purpose))return failure("OUTBOX_INTENT_PURPOSE_INVALID","Resolved outbox job purpose is unsupported.");
  if(!record(job.recipient)||!safeIdentity(job.recipient.recipientRef)||
     typeof job.recipient.optedOut!=="boolean"||
     typeof job.recipient.consentRequired!=="boolean"||
     typeof job.recipient.hasOptIn!=="boolean"||
     (job.recipient.quietHoursBlocked!==undefined&&typeof job.recipient.quietHoursBlocked!=="boolean")){
    return failure("OUTBOX_INTENT_RECIPIENT_INVALID","Resolved outbox job recipient policy is incomplete.");
  }
  if(!record(job.payload))return failure("OUTBOX_INTENT_PAYLOAD_INVALID","Resolved outbox job payload is not structured.");
  if(job.handoverGuard!==undefined&&(!record(job.handoverGuard)||
     !safeIdentity(job.handoverGuard.conversationId)||
     !Number.isSafeInteger(job.handoverGuard.expectedConversationVersion)||
     job.handoverGuard.expectedConversationVersion<0||
     typeof job.handoverGuard.handoverActive!=="boolean")){
    return failure("OUTBOX_INTENT_HANDOVER_INVALID","Resolved conversation takeover evidence is incomplete.");
  }
  return {ok:true,value:job};
}
