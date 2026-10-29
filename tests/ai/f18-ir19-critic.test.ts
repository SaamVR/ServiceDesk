import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const read=(p:string)=>readFileSync(p);
const blob=(b:Buffer)=>createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex");
const lock=JSON.parse(read("docs/delivery/sonic-ir19-f18-inbox-source-lock-20261030.json").toString()) as {
 schema:string;parentIR18:string;status:string;
 source:Array<{path:string;sha:string}>;
 route:{path:string;priorSha:string;integratedSha:string};
 constraints:string[];releaseGate:string;
};
describe("IR19 critic: genuine consent-checked Inbox but no automatic contact",()=>{
 it("imports only four exact F18 source blobs and one deliberate Inbox route successor",()=>{
  expect(lock.schema).toBe("servicedesk.ir19.f18.consent-reviewed-inbox.v1");
  expect(lock.parentIR18).toBe("72c69a0f907ebf7b4503ff0b6a0c6f4d49e61201");
  expect(lock.source).toHaveLength(4);
  expect(new Set(lock.source.map(x=>x.path)).size).toBe(4);
  for(const item of lock.source)expect(blob(read(item.path)),item.path).toBe(item.sha);
  expect(lock.route.priorSha).toBe("32b7b90471b4b6b9aa0e53fce5f885fe7bce274f");
  expect(blob(read(lock.route.path))).toBe(lock.route.integratedSha);
  expect(lock.status).toBe("SOURCE_ONLY_DRAFT_UNMERGED");
 });
 it("uses existing authenticated Inbox route with explicit selected server-only owner panel",()=>{
  const route=read(lock.route.path).toString();
  expect(route).toContain('module="inbox"');
  expect(route).toContain("<InboxConsentedDraftPanel workspaceSlug={workspace} selectedConversationId={query.conversation}/>");
  const action=read("src/features/operations/f18-consented-reply-action.ts").toString();
  expect(action).toContain("proposeF04ConsentedReplyDraft(workspaceSlug,conversationId)");
  expect(action).toContain("messageSent:false");
  expect(action).toContain("sourceHistoryComplete:false");
  for(const keyword of ["NO_DELIVERY","NO_PROVIDER","NO_MODEL","NO_DEPLOY","NO_MAIN_OR_CANONICAL_MERGE"])
   expect(lock.constraints).toContain(keyword);
  expect(lock.releaseGate).toBe("P02_OPEN_P03_QUEUED");
 });
});
