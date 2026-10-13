import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { verifiedSandboxPaymentLedgerMatch } from "../../src/features/operations/sandbox-payment-ledger-proof";

const ids={
  id:"11111111-1111-4111-8111-111111111111",
  workspace_id:"22222222-2222-4222-8222-222222222222",
  customer_id:"33333333-3333-4333-8333-333333333333",
  quote_id:"44444444-4444-4444-8444-444444444444",
  invoice_id:"55555555-5555-4555-8555-555555555555",
  hold_id:"66666666-6666-4666-8666-666666666666",
};
const compact=ids.id.replaceAll("-","");
const event="evt_sd_demo_"+compact, transaction="pi_sd_demo_"+compact;
const session={
  ...ids, purpose:"BALANCE", status:"APPLIED", amount_minor:12750,
  currency:"USD", provider_event_id:event, provider_transaction_id:transaction,
};
const applied={
  ...ids, provider:"STRIPE", provider_account_id:"acct_servicedesk_internal_sandbox",
  provider_event_id:event, provider_transaction_id:transaction,
  purpose:"BALANCE",state:"APPLIED",amount_minor:12750,currency:"USD",
};

describe("sandbox APPLIED/DUPLICATE replay verifies real payment ledger",()=>{
  test("accepts actual applied Core payment record for the exact tenant session",()=>{
    expect(verifiedSandboxPaymentLedgerMatch(session,applied)).toBe(true);
    expect(verifiedSandboxPaymentLedgerMatch(
      {...session,purpose:"DEPOSIT"},{...applied,purpose:"DEPOSIT"})).toBe(true);
  });
  test("never treats session status, review state or foreign invoice as paid",()=>{
    const overrides=[
      {state:"REVIEW"}, {amount_minor:12751},{currency:"EUR"},
      {provider:"FAKE"},{provider_account_id:"foreign"},{provider_event_id:"evt_forged"},
      {provider_transaction_id:"pi_forged"},{workspace_id:"foreign"},
      {invoice_id:"foreign"},{quote_id:"foreign"},
    ];
    for(const bad of overrides)
      expect(verifiedSandboxPaymentLedgerMatch(session,{...applied,...bad})).toBe(false);
    for(const bad of [
      {provider_event_id:null},{provider_transaction_id:null},{quote_id:"foreign"},
      {amount_minor:1},{purpose:"CHARGE"},
    ])expect(verifiedSandboxPaymentLedgerMatch({...session,...bad},applied)).toBe(false);
    expect(verifiedSandboxPaymentLedgerMatch(session,null)).toBe(false);
  });
  test("re-reads authoritative Core payment record at both UI display and replay completion",()=>{
    const source=readFileSync(join(process.cwd(),"src/features/operations/customer-product-runtime.ts"),"utf8");
    const lookup=source.slice(source.indexOf("async function hasCommittedSandboxPayment"),
      source.indexOf("export async function loadCustomerSandboxCheckout"));
    const display=source.slice(source.indexOf("export async function loadCustomerSandboxCheckout"),
      source.indexOf("export async function completeCustomerSandboxCheckout"));
    const finish=source.slice(source.indexOf("export async function completeCustomerSandboxCheckout"));
    expect(lookup).toContain('from("verified_payment_applications")');
    expect(lookup).toContain('eq("workspace_id", session.workspace_id)');
    expect(lookup).toContain('eq("provider_event_id", eventId)');
    expect(lookup).toContain("verifiedSandboxPaymentLedgerMatch(session");
    expect(display).toContain('row.status === "APPLIED" || row.status === "DUPLICATE"');
    expect(display).toContain("hasCommittedSandboxPayment(resolved.value.service, row)");
    expect(finish).toContain("hasCommittedSandboxPayment(resolved.value.service, session)");
    expect(finish.indexOf("hasCommittedSandboxPayment(")).toBeLessThan(
      finish.indexOf('sessionStatus === "APPLIED"'));
  });
});
