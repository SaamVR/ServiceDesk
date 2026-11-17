import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(p,"utf8");
describe("F15 independent release safety critic",()=>{
 it("blocks canonical 0004 staff forged SLA attention despite broad attention grant",()=>{
  const canonical=read("supabase/migrations/0004_ledger_outbox_attention.sql");
  const sql=read("docs/engineering/security/f15-unanswered-lead-atomic-attention-v3.sql");
  const pg=read("tests/sql/v4-f15-atomic-pg17-acceptance-v3.sql");
  expect(canonical).toContain("create policy attention_staff_all");
  for(const op of ["insert","update","delete"])
   expect(sql).toContain("as restrictive for "+op+" to authenticated");
  expect(sql).toContain("f15_review_attention_all_states_unique");
  expect(sql).not.toContain("create extension if not exists pgcrypto;");
  for(const denial of ["F15_STAFF_FORGED_INSERT_ALLOWED","F15_STAFF_EDITED_INTERNAL_REVIEW","F15_STAFF_DELETED_INTERNAL_REVIEW","F15_ACK_DUPLICATE_ATTENTION_ALLOWED"])
   expect(pg).toContain(denial);
 });
 it("acknowledgement is explicit, owner-only, one OPEN, CAS, persisted readback",()=>{
  const s=read("src/server/workflows/sonic-f15-owner-acknowledge.ts");
  const a=read("src/features/operations/f15-owner-acknowledge-action.ts");
  const ui=read("src/features/operations/OwnerLinkedAttentionReview.tsx");
  expect(s).toContain("SERVICEDESK_F15_OWNER_MANUAL_ESCALATION_ENABLED");
  expect(s).toContain('actor.role!=="OWNER"');
  expect(s).toContain('branchScope.mode!=="ALL"');
  expect(s).toContain('state:"AMBIGUOUS"');
  expect(s).toContain('status:"ACKNOWLEDGED"');
  expect(s).toContain("readback??checkSaved");
  expect(a).toContain('"use server"');
  expect(ui).toContain("proof.open===1");
  expect(ui).toContain("Acknowledge the sole open F15 attention");
  for(const forbidden of ["sendEmail(","sendWhatsApp(","processPayment(","runWorkflow("])
   expect(s+a+ui).not.toContain(forbidden);
 });
});
