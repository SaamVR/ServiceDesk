import { describe, expect, test } from "vitest";
import { dispatchCommittedOutboxJob } from "../../src/server/integrations/outbox/dispatch-router";
import { dispatchOutcomeBase, type CommittedOutboxDispatcher } from "../../src/server/integrations/outbox/dispatch-port";
import type { OutboxJob } from "../../src/server/integrations/types";

const job: OutboxJob = {
  id:"job-1",workspaceId:"workspace-1",channel:"WHATSAPP",purpose:"QUOTE",
  recipient:{recipientRef:"recipient-1",consentRequired:true,hasOptIn:true,optedOut:false},
  createdAt:"2026-10-13T08:00:00.000Z",idempotencyKey:"once-only",payload:{},
};
const claim="2026-10-13T08:01:00.000Z";
async function ack(acceptedAt:string,capturedAt:string) {
  const dispatcher:CommittedOutboxDispatcher={
    async dispatch(input) {
      return {ok:true,value:{
        ...dispatchOutcomeBase(input.job),outcome:"ACCEPTED" as const,
        providerMessageId:"wamid.provider.acceptance",acceptedAt,providerMode:"SANDBOX" as const,
        evidence:{provider:"WHATSAPP" as const,mode:"SANDBOX" as const,
          verification:"PROVIDER_VERIFIED" as const,capturedAt,notes:[]},
      }};
    },
  };
  return dispatchCommittedOutboxJob({job,committedAt:claim,attempt:1,
    expectedWorkspaceId:job.workspaceId,dispatchers:{WHATSAPP:dispatcher}});
}
describe("outbox provider acceptance chronology",()=>{
  test("accepts a real chronological response with an exact committed claim",async()=>{
    expect(await ack(claim,claim)).toMatchObject({ok:true,value:{outcome:"ACCEPTED"}});
    expect(await ack("2026-10-13T08:01:03Z","2026-10-13T08:01:04Z"))
      .toMatchObject({ok:true,value:{outcome:"ACCEPTED"}});
  });
  test("forbids provider ACK timestamp older than the committed send attempt",async()=>{
    expect(await ack("2026-10-13T08:00:59.999Z","2026-10-13T08:02:00Z"))
      .toMatchObject({ok:true,value:{outcome:"TERMINAL_FAILURE",
        code:"DISPATCH_OUTCOME_IDENTITY_MISMATCH"}});
  });
  test("forbids evidence capture before acceptance or before the committed claim",async()=>{
    expect(await ack("2026-10-13T08:01:02Z","2026-10-13T08:01:01Z"))
      .toMatchObject({ok:true,value:{outcome:"TERMINAL_FAILURE",
        code:"DISPATCH_OUTCOME_IDENTITY_MISMATCH"}});
    expect(await ack(claim,"2026-10-13T08:00:00Z"))
      .toMatchObject({ok:true,value:{outcome:"TERMINAL_FAILURE",
        code:"DISPATCH_OUTCOME_IDENTITY_MISMATCH"}});
  });
  test("never promotes malformed UTC evidence to an accepted receipt",async()=>{
    expect(await ack("2026-02-30T08:01:02Z",claim))
      .toMatchObject({ok:true,value:{outcome:"TERMINAL_FAILURE"}});
  });
});
