import {describe,expect,it,vi} from "vitest";
import {readFileSync} from "node:fs";
import {runF15OwnerManualEscalation} from "../../src/server/workflows/sonic-f15-owner-manual-escalation";
import type {F15AtomicEventCommand} from "../../src/server/workflows/sonic-f15-atomic-ingress";
const workspaceId="11111111-1111-4111-8111-111111111111";
const branchId="22222222-2222-4222-8222-222222222222";
const requestId="33333333-3333-4333-8333-333333333333";
const messageId="44444444-4444-4444-8444-444444444444";
const userId="55555555-5555-4555-8555-555555555555";
const facts=()=>({workspaceId,branchId,requestId,version:2,
 status:"COLLECTING" as const,createdAt:"2026-10-29T08:00:00.000Z",
 lastInboundAt:"2026-10-29T08:10:00.000Z",
 lastInboundMessageId:messageId,lastStaffResponseAt:null,responseHistoryComplete:true as const});
const context=()=>({workspaceId,userId,branchIds:[branchId],
 service:{} as never,rpc:{} as never});
const dependencies=()=>({
 enabled:()=>true,owner:async()=>context(),
 loadFacts:async()=>facts(),now:()=> "2026-10-29T10:00:00.000Z",
});
describe("F15 real callable owner Inbox -> durable internal SLA claim",()=>{
 it("is default-denied: disable before any privileged actor, message or RPC call",async()=>{
  const owner=vi.fn(async()=>context());
  expect(await runF15OwnerManualEscalation("workspace",branchId,requestId,{
   enabled:()=>false,owner,
  })).toEqual({state:"NOT_ACTIVATED"});
  expect(owner).not.toHaveBeenCalled();
 });
 it("one committed event and one verified replay, no provider sends or workflow execution",async()=>{
  const keys=new Set<string>(),commits=vi.fn(async(cmd:Readonly<F15AtomicEventCommand>)=>{
   expect(Object.isFrozen(cmd)).toBe(true);
   expect(cmd.eventType).toBe("UNANSWERED_LEAD_SLA_REVIEW");
   expect(cmd.workspaceId).toBe(workspaceId);
   expect(cmd.branchId).toBe(branchId);
   expect(cmd.customerMessageAuthorized).toBe(false);
   const duplicate=keys.has(cmd.eventKey);
   keys.add(cmd.eventKey);
   return {
    state:duplicate?"ALREADY_RECORDED":"INSERTED",
    eventKey:cmd.eventKey,workspaceId:cmd.workspaceId,branchId:cmd.branchId,
    requestId:cmd.requestId,sourceVersion:cmd.sourceVersion,
    sourceLastInboundAt:cmd.sourceLastInboundAt,
    sourceLastInboundMessageId:cmd.sourceLastInboundMessageId,
    transactionCommitted:true,sourceRecheckedUnderLock:true,
    uniqueEventKeyEnforced:true,externalSideEffects:false,
    savedRowsInserted:duplicate?0:1,
   };
  });
  const deps={...dependencies(),port:()=>({claimVerifiedEvent:commits})};
  expect(await runF15OwnerManualEscalation("workspace",branchId,requestId,deps))
   .toMatchObject({state:"OWNER_REVIEW_RECORDED",durableInternalReview:true,
      customerMessaged:false,workflowExecuted:false,modelInvoked:false});
  expect(await runF15OwnerManualEscalation("workspace",branchId,requestId,deps))
   .toMatchObject({state:"ALREADY_RECORDED",durableInternalReview:true,
      customerMessaged:false,workflowExecuted:false});
  expect(keys.size).toBe(1);
  expect(commits).toHaveBeenCalledTimes(2);
 });
 it("fails closed on foreign branch, incomplete history, stale reply or forged receipt",async()=>{
  const commit=vi.fn();
  const port=()=>({claimVerifiedEvent:commit});
  expect((await runF15OwnerManualEscalation("workspace",
   "66666666-6666-4666-8666-666666666666",requestId,
   {...dependencies(),port})).state).toBe("UNAVAILABLE");
  expect((await runF15OwnerManualEscalation("workspace",branchId,requestId,{
   ...dependencies(),loadFacts:async()=>null,port,
  })).state).toBe("UNAVAILABLE");
  expect((await runF15OwnerManualEscalation("workspace",branchId,requestId,{
   ...dependencies(),loadFacts:async()=>({...facts(),
    lastStaffResponseAt:"2026-10-29T09:00:00.000Z"}),port,
  })).state).toBe("NOT_DUE");
  expect(commit).not.toHaveBeenCalled();
  const bad=await runF15OwnerManualEscalation("workspace",branchId,requestId,{
   ...dependencies(),port:()=>({claimVerifiedEvent:async()=>({ok:true})}),
  });
  expect(bad).toEqual({state:"UNAVAILABLE"});
 });
 it("Inbox entrypoint binds a specific authorized saved request, not a browser tenant",()=>{
  const panel=readFileSync("src/features/operations/InboxProtectedLeadReviewPanel.tsx","utf8");
  const route=readFileSync("src/app/app/[workspace]/inbox/page.tsx","utf8");
  const action=readFileSync("src/features/operations/f15-owner-lead-sla-action.ts","utf8");
  expect(route).toContain("<InboxProtectedLeadReviewPanel workspaceSlug={workspace} selectedConversationId={query.conversation}/>");
  expect(panel).toContain('s.value.actor.role!=="OWNER"');
  expect(panel).toContain('s.value.branchScope?.mode!=="ALL"');
  expect(panel).toContain("selectedConversationId");
  expect(action).toContain('"use server"');
  expect(action).toContain("runF15OwnerManualEscalation(");
 });
});
