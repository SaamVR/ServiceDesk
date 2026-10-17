import {describe,expect,it,vi} from "vitest";
import {resolveCalendarVisitOutboxIntent} from "../../src/server/integrations/outbox/calendar-visit-intent";
import type {ClaimedOutboxEvent} from "../../src/contracts/outbox";
import type {CalendarVisitAuthoritativeSource} from "../../src/server/integrations/outbox/calendar-visit-intent";
const at="2026-10-17T10:00:00.000Z";
const event:ClaimedOutboxEvent={id:"event-r20d",workspaceId:"ws-r20d",topic:"calendar.visit.upsert",
 payload:{visitId:"visit-r20d",crewId:"crew-r20d"},idempotencyKey:"claim-r20d",attempt:1,claimedAt:at};
const source:CalendarVisitAuthoritativeSource={eventId:event.id,workspaceId:event.workspaceId,action:"UPSERT",
 idempotencyKey:event.idempotencyKey,summary:"Scheduled visit",
 visit:{id:"visit-r20d",workspaceId:event.workspaceId,requestId:"req-r20d",quoteId:"quote-r20d",
  crewId:"crew-r20d",status:"CONFIRMED",startAt:"2026-10-18T10:00:00.000Z",serviceMinutes:90,bufferMinutes:30,version:1},
 binding:{workspaceId:event.workspaceId,crewId:"crew-r20d",calendarId:"calendar-r20d",status:"CONNECTED",
  syncToken:"sync-r20d",lastSyncedAt:at,stale:false,timezone:"Asia/Dhaka"}
};
const port=(value:CalendarVisitAuthoritativeSource=source)=>({load:vi.fn(async()=>({ok:true as const,value}))});
const check=(claimed:ClaimedOutboxEvent,loaded=source)=>resolveCalendarVisitOutboxIntent(claimed,port(loaded));
describe("R20D trusted calendar outbox claim cannot be silently substituted",()=>{
 it("allows an exact tenant, visit, crew and idempotency claim",async()=>{
  const result=await check(event);
  expect(result).toMatchObject({ok:true,value:{workspaceId:event.workspaceId,idempotencyKey:event.idempotencyKey}});
 });
 it("rejects malformed present claim identities before source IO",async()=>{
  for(const key of ["visitId","crewId"] as const){
   for(const bad of [null,{},[],false,""," wrong","wrong ", "wrong\nline","x".repeat(257)]){
    const p=port();
    const claimed={...event,payload:{...event.payload,[key]:bad}} as ClaimedOutboxEvent;
    expect(await resolveCalendarVisitOutboxIntent(claimed,p)).toMatchObject({ok:false,code:"CALENDAR_OUTBOX_CLAIM_INVALID"});
    expect(p.load).not.toHaveBeenCalled();
   }
  }
 });
 it("rejects nonobject claims and mismatched durable source replay keys",async()=>{
  for(const payload of [null,[],false]){
   const p=port();
   expect(await resolveCalendarVisitOutboxIntent({...event,payload} as ClaimedOutboxEvent,p))
    .toMatchObject({ok:false,code:"CALENDAR_OUTBOX_PAYLOAD_INVALID"});
   expect(p.load).not.toHaveBeenCalled();
  }
  expect(await check(event,{...source,idempotencyKey:"different-r20d"}))
   .toMatchObject({ok:false,code:"CALENDAR_OUTBOX_IDENTITY_MISMATCH"});
  expect(await check({...event,payload:{...event.payload,visitId:"other-visit"}}))
   .toMatchObject({ok:false,code:"CALENDAR_OUTBOX_VISIT_MISMATCH"});
 });

  it("rejects corrupted recovery projections before any external calendar dispatch",async()=>{
    const good = await check(event);
    expect(good.ok).toBe(true);
    if(!good.ok)return;
    const {readCalendarVisitProjection} = await import("../../src/server/integrations/outbox/calendar-visit-intent");
    const job=good.value;
    expect(readCalendarVisitProjection(job)).toMatchObject({ok:true});
    for(const corrupt of [null,[],{},false]){
      expect(readCalendarVisitProjection({...job,payload:corrupt} as typeof job))
        .toMatchObject({ok:false,code:"CALENDAR_VISIT_PAYLOAD_INVALID"});
    }
    const projected=job.payload.calendarVisit as Record<string,unknown>;
    for(const altered of [
      {...projected,visit:{...source.visit,workspaceId:"foreign-workspace"}},
      {...projected,visit:{...source.visit,id:"other-visit"}},
      {...projected,visit:{...source.visit,crewId:"other-crew"}},
      {...projected,providerMappingKey:"fake-mapping"},
      {...projected,workspaceId:{toString(){throw Error("UNTRUSTED_CALENDAR_ID_COERCION");}}},
      {...projected,visit:{...source.visit,id:{toString(){throw Error("UNTRUSTED_VISIT_ID_COERCION");}}}},
      {...projected,action:"DELETE"},
    ]){
      expect(readCalendarVisitProjection({...job,payload:{calendarVisit:altered}}))
        .toMatchObject({ok:false,code:"CALENDAR_VISIT_PAYLOAD_INVALID"});
    }
  });
});
