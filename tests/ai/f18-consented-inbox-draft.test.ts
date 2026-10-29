import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {requestF18ConsentedReplyDraft} from "../../src/features/operations/f18-consented-reply-action";
describe("F18 actual owner Inbox draft but no send",()=>{
 it("rejects malformed tenant/record input without calling provider",async()=>{
  expect(await requestF18ConsentedReplyDraft("bad/slug","bad")).toEqual({ok:false,state:"CONSENTED_DRAFT_UNAVAILABLE"});
  expect(await requestF18ConsentedReplyDraft("workspace","contact@example.org")).toEqual({ok:false,state:"CONSENTED_DRAFT_UNAVAILABLE"});
 });
 it("requires saved thread+consent engine, explicit exact safe text and no effects",()=>{
  const src=readFileSync("src/features/operations/f18-consented-reply-action.ts","utf8");
  expect(src).toContain("proposeF04ConsentedReplyDraft(workspaceSlug,conversationId)");
  expect(src).toContain("v.draftText!==expected");
  expect(src).toContain("sendTimeConsentRecheckRequired:true");
  expect(src).toContain("messageSent:false");
  for(const bad of ["fetch(", ".rpc(", "sendEmail(", "sendWhatsApp(", "process.env."])
   expect(src).not.toContain(bad);
 });
 it("renders only owner verified ALL-branch inbox conversation selection",()=>{
  const src=readFileSync("src/features/operations/InboxConsentedDraftPanel.tsx","utf8");
  expect(src).toContain("loadOperationalStaffSnapshot(workspaceSlug)");
  expect(src).toContain('result.value.actor.role!=="OWNER"');
  expect(src).toContain('result.value.branchScope?.mode!=="ALL"');
  expect(src).toContain("<AiConsentedInboxDraft workspaceSlug={workspaceSlug} conversationId={selected.id}/>");
  const ui=readFileSync("src/features/operations/AiConsentedInboxDraft.tsx","utf8");
  expect(ui).toContain('key={workspaceSlug+":"+conversationId}');
  expect(ui).toContain("serial.current!==seq");
  expect(ui).toContain("not been saved or sent");
 });
});
