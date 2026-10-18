import {describe,expect,it} from "vitest";
import {decideOutboxPersistence} from "../../src/server/jobs/outbox-retry";
import type {OutboxRetryPolicyInput} from "../../src/server/jobs/outbox-retry";
const at="2026-10-18T13:00:00.000+06:00";
const base={
 event:{id:"event-001",attempt:1},maxAttempts:3,baseDelaySeconds:60,
 outcome:{outcome:"SENT" as const,completedAt:at},
} as OutboxRetryPolicyInput;
const evaluate=(outcome:unknown,patch:Partial<OutboxRetryPolicyInput>={})=>
 decideOutboxPersistence({...base,...patch,outcome:outcome as OutboxRetryPolicyInput["outcome"]});
describe("SONIC R39 L17 provider outbox civil timestamp and retry boundaries",()=>{
 it("accepts legitimate zoned SENT and preserves exact provider completion evidence",()=>{
  expect(evaluate({outcome:"SENT",completedAt:at})).toMatchObject({
   ok:true,value:{action:"markSent",eventId:"event-001",completedAt:at}
  });
  expect(evaluate({outcome:"RETRYABLE_FAILURE",failedAt:at,code:"TRANSIENT"}))
   .toMatchObject({ok:true,value:{action:"markRetry",nextAttemptAt:"2026-10-18T07:01:00.000Z"}});
 });
 it("rejects imaginary dates, impossible clock fields, timezone spoofing and unzoned times for every state",()=>{
  const forged=[
   "2026-02-30T07:00:00Z","2026-04-31T07:00:00Z",
   "2026-10-18T25:00:00Z","2026-10-18T07:61:00Z",
   "2026-10-18T07:00:00+14:01","2026-10-18T07:00:00-15:00",
   "2026-10-18T07:00:00","2026-10-18 07:00:00","yesterday",
  ];
  for(const bad of forged){
   expect(evaluate({outcome:"SENT",completedAt:bad}),bad)
    .toMatchObject({ok:false,code:"OUTBOX_COMPLETED_AT_INVALID"});
   for(const outcome of ["RETRYABLE_FAILURE","TERMINAL_FAILURE","SUPPRESSED"]){
    expect(evaluate({outcome,failedAt:bad,code:"FAILED"}),bad)
     .toMatchObject({ok:false,code:"OUTBOX_FAILED_AT_INVALID"});
   }
  }
 });
 it("keeps retry schedule bounded and invalid input from crashing the worker",()=>{
  expect(evaluate({outcome:"RETRYABLE_FAILURE",failedAt:at,code:"RATE_LIMIT",retryAfterSeconds:1e18}))
   .toMatchObject({ok:false,code:"OUTBOX_RETRY_SCHEDULE_INVALID"});
  expect(decideOutboxPersistence({event:{id:"bad/email",attempt:1},
   outcome:{outcome:"SENT",completedAt:at},maxAttempts:3} as OutboxRetryPolicyInput))
   .toMatchObject({ok:false,code:"OUTBOX_EVENT_INVALID"});
  expect(decideOutboxPersistence(null as unknown as OutboxRetryPolicyInput))
   .toMatchObject({ok:false,code:"OUTBOX_EVENT_INVALID"});
 });
});
