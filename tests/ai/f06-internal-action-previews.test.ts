import {describe,expect,it} from "vitest";
import {proposeF06TypedEvent} from "../../src/server/ai/f06-typed-event-proposals";
import {previewF06InternalAction} from "../../src/server/ai/f06-internal-action-previews";
const source={eventType:"QUOTE_EXPIRED",workspaceId:"workspace-1",
 branchId:"branch-1",sourceId:"quote-1",sourceVersion:2,
 status:"SENT",validUntil:"2026-10-24T03:00:00.000Z"};
const eventInput={actor:{workspaceId:"workspace-1",role:"OWNER"},
 workspaceId:"workspace-1",branchId:"branch-1",
 observedAt:"2026-10-25T06:00:00.000Z",expectedSourceVersion:2,
 record:source};
function fingerprint(){const r=proposeF06TypedEvent(eventInput);
 if(!r.ok)throw Error("fixture");return r.value.eventProposalFingerprint;}
const request=(intent:unknown,patch:Record<string,unknown>={})=>({
 eventInput,expectedEventFingerprint:fingerprint(),intent,...patch,
});
describe("F06 internal action previews are revalidated and never executed",()=>{
 it("supports exactly four internal-only types with no side effects",()=>{
  for(const [intent,kind] of [
   [{kind:"CREATE_TASK",taskCode:"REVIEW_SOURCE_EVENT"},"CREATE_TASK"],
   [{kind:"REQUEST_OWNER_APPROVAL",approvalCode:"OPERATIONS_EXCEPTION"},"REQUEST_OWNER_APPROVAL"],
   [{kind:"SCHEDULE_REMINDER",purpose:"INTERNAL_OWNER_REVIEW",
     remindAt:"2026-10-26T09:00:00.000Z"},"SCHEDULE_REMINDER"],
   [{kind:"EMIT_OWNER_DIGEST",digestCode:"OWNER_EVENT_REVIEW"},"EMIT_OWNER_DIGEST"],
  ] as const){
    const r=previewF06InternalAction(request(intent));
    expect(r).toMatchObject({ok:true,value:{
      state:"F06_UNPERSISTED_INTERNAL_ACTION_PREVIEW_ONLY",kind,
      workspaceId:"workspace-1",branchId:"branch-1",eventType:"QUOTE_EXPIRED",
      eventProposalFingerprint:fingerprint(),
      actionPreviewFingerprint:expect.stringMatching(/^[a-f0-9]{64}$/),
      executionIdempotencyUnproven:true,serverAuthorityRequired:true,
      executionWriterUnavailable:true,businessTimeZoneUnverified:true,
      ownerApprovalRequired:true,scheduled:false,persisted:false,
      executed:false,published:false,providerCalled:false,
      customerMessageSent:false,financialStateMutated:false,
    }});
  }
 });
 it("refuses forged/stale event digest, stale source revision and foreign tenant",()=>{
  const base=fingerprint();
  expect(previewF06InternalAction({
    ...request({kind:"CREATE_TASK",taskCode:"REVIEW_SOURCE_EVENT"}),
    expectedEventFingerprint:"a".repeat(64),
  })).toMatchObject({ok:false,code:"F06_ACTION_FINGERPRINT_STALE"});
  const changed={...eventInput,expectedSourceVersion:3,
    record:{...source,sourceVersion:3}};
  expect(previewF06InternalAction({
    eventInput:changed,expectedEventFingerprint:base,
    intent:{kind:"CREATE_TASK",taskCode:"REVIEW_SOURCE_EVENT"},
  })).toMatchObject({ok:false,code:"F06_ACTION_FINGERPRINT_STALE"});
  expect(previewF06InternalAction({
    ...request({kind:"CREATE_TASK",taskCode:"REVIEW_SOURCE_EVENT"}),
    eventInput:{...eventInput,actor:{role:"OWNER",workspaceId:"foreign"}},
  })).toMatchObject({ok:false,code:"F06_ACTION_EVENT_UNVERIFIED"});
 });
 it("never uses a missing/future due date, overlong wait or invented reminder schedule",()=>{
  for(const remindAt of [
   "2026-10-25T05:59:59.000Z","2026-11-05T06:00:00.000Z",
   "2026-02-30T03:00:00.000Z","tomorrow at 3 pm",
  ]){
   const r=previewF06InternalAction(request({
     kind:"SCHEDULE_REMINDER",purpose:"INTERNAL_OWNER_REVIEW",remindAt,
   }));
   expect(r).toMatchObject({ok:false,code:"F06_ACTION_REMINDER_INVALID"});
  }
  const after=previewF06InternalAction(request({
   kind:"SCHEDULE_REMINDER",purpose:"INTERNAL_OWNER_REVIEW",
   remindAt:"2026-10-26T06:00:00.000Z",
  }));
  expect(after).toMatchObject({ok:true,value:{
   scheduled:false,businessTimeZoneUnverified:true,
   reminderPurpose:"INTERNAL_OWNER_REVIEW",
  }});
 });
 it("rejects provider messaging, financial mutation and unknown action type",()=>{
  for(const intent of [
   {kind:"SEND_EMAIL_TEMPLATE",recipient:"CUSTOMER_PRIMARY"},
   {kind:"CHARGE_CUSTOMER",amountMinor:3000},
   {kind:"PUBLISH_RULE",publish:true},
   {kind:"CREATE_TASK",taskCode:"RUN_ARBITRARY_SQL"},
   {kind:"REQUEST_OWNER_APPROVAL",approvalCode:"SEND_PAYMENTS"},
   {kind:"EMIT_OWNER_DIGEST",digestCode:"EMAIL_CUSTOMER"},
  ])expect(previewF06InternalAction(request(intent))).toMatchObject({
   ok:false,code:"F06_ACTION_INPUT_INVALID",
  });
 });
 it("rejects hidden/symbol/accessor controls in nested intents without invoking getter",()=>{
  const hidden=Object.defineProperty({
   kind:"CREATE_TASK",taskCode:"REVIEW_SOURCE_EVENT",
  },"autoExecute",{value:true,enumerable:false});
  const getter=Object.defineProperty({
   kind:"CREATE_TASK",taskCode:"REVIEW_SOURCE_EVENT",
  },"providerToken",{get:()=>{throw Error("must not execute");}});
  const symbol={kind:"EMIT_OWNER_DIGEST",
    digestCode:"OWNER_EVENT_REVIEW",[Symbol("external")]:true};
  for(const intent of [hidden,getter,symbol,
   {kind:"CREATE_TASK",taskCode:"REVIEW_SOURCE_EVENT",customerEmail:"private@example.com"}]){
   const result=previewF06InternalAction(request(intent));
   expect(result).toMatchObject({ok:false,code:"F06_ACTION_INPUT_INVALID"});
   expect(JSON.stringify(result)).not.toContain("private@example.com");
  }
  const envelope=Object.defineProperty(request({
   kind:"CREATE_TASK",taskCode:"REVIEW_SOURCE_EVENT",
  }),"publish",{value:true,enumerable:false});
  expect(previewF06InternalAction(envelope)).toMatchObject({
   ok:false,code:"F06_ACTION_INPUT_INVALID",
  });
 });
 it("derives stable preview fingerprints scoped by exact candidate and intent",()=>{
  const a=previewF06InternalAction(request({kind:"CREATE_TASK",
   taskCode:"REVIEW_SOURCE_EVENT"}));
  const b=previewF06InternalAction(request({kind:"CREATE_TASK",
   taskCode:"REVIEW_SOURCE_EVENT"}));
  const c=previewF06InternalAction(request({kind:"CREATE_TASK",
   taskCode:"INVESTIGATE_EXCEPTION"}));
  expect(a).toEqual(b);
  if(a.ok&&c.ok)
   expect(a.value.actionPreviewFingerprint).not.toBe(c.value.actionPreviewFingerprint);
 });
});
