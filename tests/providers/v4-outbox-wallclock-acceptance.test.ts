import { describe, expect, test } from "vitest";
import { dispatchCommittedOutboxJob } from "../../src/server/integrations/outbox/dispatch-router";
import { dispatchOutcomeBase, type CommittedOutboxDispatcher } from "../../src/server/integrations/outbox/dispatch-port";
import type { OutboxJob } from "../../src/server/integrations/types";

const at=(offset:number)=>new Date(Date.now()+offset).toISOString();
function job(createdAt: string): OutboxJob {
  return { id: "job-clock", workspaceId: "workspace-test", channel: "WHATSAPP",
    purpose: "QUOTE", recipient: { recipientRef:"customer-test",consentRequired:true,hasOptIn:true,optedOut:false },
    createdAt, idempotencyKey:"clock-test", payload:{} };
}

describe("durable provider wall-clock chronology gates",()=>{
  test("does not call provider for a future-dated but internally chronological claim",async()=>{
    const createdAt=at(10*60_000);
    const claim=at(11*60_000);
    let sends=0;
    const fake: CommittedOutboxDispatcher={async dispatch(){sends++;throw Error("MUST_NOT_SEND");}};
    const result=await dispatchCommittedOutboxJob({
      job:job(createdAt),committedAt:claim,attempt:1,
      expectedWorkspaceId:"workspace-test",dispatchers:{ WHATSAPP:fake },
    });
    expect(sends).toBe(0);
    expect(result).toMatchObject({ok:true,value:{
      outcome:"TERMINAL_FAILURE",code:"OUTBOX_COMMIT_CLAIM_INVALID",
    }});
  });
  test("rejects an accepted adapter receipt dated materially after wall clock",async()=>{
    const now=at(-1000);
    const claimed=job(now);
    let sends=0;
    const fake:CommittedOutboxDispatcher={
      async dispatch(input) {
        sends++;
        const after=at(12*60_000);
        return {ok:true,value:{...dispatchOutcomeBase(input.job),
          outcome:"ACCEPTED", providerMessageId:"wamid.future.evidence",
          acceptedAt:after,providerMode:"SANDBOX",evidence:{
            provider:"WHATSAPP",mode:"SANDBOX",verification:"PROVIDER_VERIFIED",
            capturedAt:after,notes:[],
          },
        }};
      },
    };
    const result=await dispatchCommittedOutboxJob({job:claimed,committedAt:now,
      attempt:1,expectedWorkspaceId:"workspace-test",dispatchers:{WHATSAPP:fake}});
    expect(sends).toBe(1);
    expect(result).toMatchObject({ok:true,value:{
      outcome:"TERMINAL_FAILURE",code:"DISPATCH_OUTCOME_IDENTITY_MISMATCH",
    }});
    expect(JSON.stringify(result)).not.toContain("wamid.future.evidence");
  });
  test("accepts a current chronological sandbox receipt without claiming delivery",async()=>{
    const now=at(-1000), claimed=job(now);
    const fake:CommittedOutboxDispatcher={
      async dispatch(input) {
        const current=at(0);
        return {ok:true,value:{...dispatchOutcomeBase(input.job),
          outcome:"ACCEPTED",providerMessageId:"wamid.accepted",
          acceptedAt:current,providerMode:"SANDBOX",evidence:{
            provider:"WHATSAPP",mode:"SANDBOX",verification:"PROVIDER_VERIFIED",
            capturedAt:current,notes:[],
          },
        }};
      },
    };
    const result=await dispatchCommittedOutboxJob({job:claimed,committedAt:now,
      attempt:1,expectedWorkspaceId:"workspace-test",dispatchers:{WHATSAPP:fake}});
    expect(result).toMatchObject({ok:true,value:{
      outcome:"ACCEPTED",providerMessageId:"wamid.accepted",
    }});
  });
});
