import {describe,expect,it} from "vitest";
import {buildAiActionAuditRecord} from "../../src/server/ai/action-audit";
const fixture=()=>({
  workspaceId:"ws-clean",conversationId:"conv-1",messageId:"msg-1",
  model:"gpt-6",promptVersion:"studio-v4",capturedAt:"2026-10-18T03:00:00.000Z",
  toolResults:[{toolName:"calculateQuote",outcome:"PROPOSED" as const,
    evidenceRef:"quote-draft:quote-1",summary:"Draft quote for owner review."}],
  blockedActions:[{name:"markPaymentPaid",reason:"BUSINESS_TRUTH_TOOL_BLOCKED"}],
  privateReasoning:"never persist hidden chain of thought",
});
describe("R36 audit rejects untrusted model/provider fields",()=>{
  it("retains safe identifiers, tool receipts and actionable reject reason",()=>{
    expect(buildAiActionAuditRecord(fixture())).toMatchObject({
      workspaceId:"ws-clean",conversationId:"conv-1",model:"gpt-6",
      toolResults:[{toolName:"calculateQuote",outcome:"PROPOSED",
        evidenceRef:"quote-draft:quote-1"}],
      blockedActions:[{name:"markPaymentPaid",reason:"BUSINESS_TRUTH_TOOL_BLOCKED"}],
      blockedActionCount:1,privateReasoningStored:false,canMutateBusinessTruth:false,
    });
  });
  it("redacts secrets, contacts, links and arbitrary rejected-tool names",()=>{
    const r=buildAiActionAuditRecord({
      ...fixture(),model:"Bearer sk_live_sensitive_token_123",
      promptVersion:"https://example.test/private?token=secret",
      conversationId:"private@example.test",
      toolResults:[{
        toolName:"send https://example.test/private",outcome:"PROPOSED",
        evidenceRef:"https://private.example?key=secret",
        summary:"Bearer sk_test_secret_abcdef phone +880 1700 123456 email private@example.test https://example.test/p?key=token",
      }],
      blockedActions:[{name:"Bearer token-secret",reason:"private@example.test"}],
    });
    const serialized=JSON.stringify(r);
    for(const leak of ["secret_abcdef","private@example.test","example.test","token-secret","880 1700 123456"])
      expect(serialized).not.toContain(leak);
    expect(r.toolResults[0].evidenceRef).toBeUndefined();
    expect(r.blockedActions).toMatchObject([{name:"unknown",reason:"SCHEMA_VIOLATION"}]);
    expect(r.model).toBe("unverified");
  });
  it("independent critic: a syntactically valid API key must not be accepted as tool ID or model label",()=>{
    const result=buildAiActionAuditRecord({...fixture(),
      model:"sk_live_secret_enoughtoleak",
      conversationId:"sk_live_secret_enoughtoleak",
      toolResults:[{toolName:"sk_live_secret_enoughtoleak",outcome:"FAILED",
        summary:"Only a fictional review result"}],
      blockedActions:[{name:"sk_live_secret_enoughtoleak",reason:"SCHEMA_VIOLATION"}],
    });
    expect(JSON.stringify(result)).not.toContain("sk_live_secret_enoughtoleak");
    expect(result.toolResults[0].toolName).toBe("unknown");
    expect(result.blockedActions[0].name).toBe("unknown");
  });
  it("bounds result fanout and refuses toxic timestamp and provenance strings",()=>{
    const r=buildAiActionAuditRecord({...fixture(),capturedAt:"2026-02-30T03:00:00.000Z",
      toolResults:Array(90).fill({toolName:"tool",outcome:"FAILED",summary:"fail"}),
      blockedActions:Array(90).fill({name:"foo",reason:"SCHEMA_VIOLATION"})});
    expect(r.toolResults).toHaveLength(64);
    expect(r.blockedActions).toHaveLength(64);
    expect(r.blockedActionCount).toBe(64);
    expect(r.capturedAt).toBe("unverified-time");
  });
});
