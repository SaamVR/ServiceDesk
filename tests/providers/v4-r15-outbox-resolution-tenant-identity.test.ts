import {describe,it,expect} from "vitest";
import {validateResolvedOutboxJob} from "../../src/server/integrations/outbox/intent-resolver";
import type {ClaimedOutboxEvent} from "../../src/contracts/outbox";
import type {OutboxJob} from "../../src/server/integrations/types";
const now="2026-10-17T00:00:00.000Z";
const evt={id:"outbox-r15-a",workspaceId:"workspace-r15-a",idempotencyKey:"idempotency-r15-a",
  claimedAt:now,attempt:1} as ClaimedOutboxEvent;
const valid:OutboxJob={id:evt.id,workspaceId:evt.workspaceId,idempotencyKey:evt.idempotencyKey,
 channel:"WHATSAPP",purpose:"QUOTE",createdAt:now,payload:{},
 recipient:{recipientRef:"recipient-r15-a",consentRequired:true,hasOptIn:true,optedOut:false}};
const check=(v:unknown)=>validateResolvedOutboxJob(evt,v as OutboxJob);
describe("R15 durable provider-intent resolution authority",()=>{
 it("accepts an exact claimed workspace and complete recipient policy",()=>{
  expect(check(valid)).toMatchObject({ok:true});
  expect(check({...valid,recipient:{...valid.recipient,quietHoursBlocked:true}})).toMatchObject({ok:true});
 });
 it("refuses malformed source identity and cross-tenant substitution before dispatch",()=>{
  for(const bad of [null,undefined,[],{},false])expect(check(bad)).toMatchObject({ok:false,code:"OUTBOX_INTENT_IDENTITY_INVALID"});
  expect(check({...valid,id:"other"})).toMatchObject({ok:false,code:"OUTBOX_INTENT_ID_MISMATCH"});
  expect(check({...valid,workspaceId:"workspace-r15-b"})).toMatchObject({ok:false,code:"OUTBOX_INTENT_WORKSPACE_MISMATCH"});
  expect(check({...valid,idempotencyKey:"foreign"})).toMatchObject({ok:false,code:"OUTBOX_INTENT_IDEMPOTENCY_MISMATCH"});
  for(const bad of ["  recipient","recipient\\nsecret","",{},true,"a".repeat(257)])
   expect(check({...valid,recipient:{...valid.recipient,recipientRef:bad}})).toMatchObject({ok:false,code:"OUTBOX_INTENT_RECIPIENT_INVALID"});
 });
 it("never trusts unsupported channel, purpose, consent or handover data",()=>{
  expect(check({...valid,channel:"PAYMENT"})).toMatchObject({ok:false,code:"OUTBOX_INTENT_CHANNEL_INVALID"});
  expect(check({...valid,purpose:"CHARGE_CARD"})).toMatchObject({ok:false,code:"OUTBOX_INTENT_PURPOSE_INVALID"});
  expect(check({...valid,recipient:{...valid.recipient,hasOptIn:"true"}})).toMatchObject({ok:false,code:"OUTBOX_INTENT_RECIPIENT_INVALID"});
  expect(check({...valid,recipient:{...valid.recipient,optedOut:0}})).toMatchObject({ok:false,code:"OUTBOX_INTENT_RECIPIENT_INVALID"});
  expect(check({...valid,payload:[]})).toMatchObject({ok:false,code:"OUTBOX_INTENT_PAYLOAD_INVALID"});
  expect(check({...valid,handoverGuard:{conversationId:"other",expectedConversationVersion:-1,handoverActive:false}}))
   .toMatchObject({ok:false,code:"OUTBOX_INTENT_HANDOVER_INVALID"});
 });
});
