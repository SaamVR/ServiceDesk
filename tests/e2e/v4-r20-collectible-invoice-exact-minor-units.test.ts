import { describe, expect, it } from "vitest";
import {
  filterInvoiceQueue, invoiceQueueCounts, invoiceQueueOf,
  isCollectibleInvoice, orderCustomerCollectionInvoices,
} from "../../src/features/operations/invoice-collection-queue";

describe("R20B staff invoice collection queue exact saved money authority", () => {
  it("never enables collection for fractional, unsafe or coercible monetary balances", () => {
    for (const balanceMinor of [
      0, -1, 1.5, NaN, Infinity, -Infinity,
      Number.MAX_SAFE_INTEGER + 1, "100", "0.01", null, undefined,
    ]) {
      for (const status of ["ISSUED", "PARTIALLY_PAID"]) {
        const record = { id: "invoice", status, balanceMinor } as never;
        expect(isCollectibleInvoice(record), `${status} ${String(balanceMinor)}`).toBe(false);
        expect(invoiceQueueOf(record)).toBe("other");
      }
    }
    expect(isCollectibleInvoice({status:"ISSUED",balanceMinor:1})).toBe(true);
    expect(isCollectibleInvoice({status:"PARTIALLY_PAID",balanceMinor:Number.MAX_SAFE_INTEGER})).toBe(true);
    expect(isCollectibleInvoice({status:"DRAFT",balanceMinor:100})).toBe(false);
  });

  it("keeps invalid financial rows out of an actionable staff collection queue", () => {
    const rows = [
      {id:"verified",status:"ISSUED",currency:"USD",balanceMinor:7500},
      {id:"fractional",status:"ISSUED",currency:"USD",balanceMinor:7500.5},
      {id:"unsafe",status:"PARTIALLY_PAID",currency:"USD",balanceMinor:Number.MAX_SAFE_INTEGER + 1},
      {id:"already-paid",status:"PAID",currency:"USD",balanceMinor:0},
      {id:"draft",status:"DRAFT",currency:"USD",balanceMinor:1000},
    ];
    expect(invoiceQueueCounts(rows)).toEqual({all:5,open:1,paid:1,void:0,other:3});
    expect(filterInvoiceQueue(rows,"open").map(r=>r.id)).toEqual(["verified"]);
    expect(orderCustomerCollectionInvoices(rows).map(x=>x.id)).toEqual([
      "verified", "draft", "fractional", "unsafe", "already-paid",
    ]);
  });

  it("does not compare priority across distinct currencies or mutate source records", () => {
    const rows = [
      {id:"usd",currency:"USD",status:"ISSUED",balanceMinor:100},
      {id:"eur",currency:"EUR",status:"ISSUED",balanceMinor:200},
      {id:"unsafe",currency:"USD",status:"ISSUED",balanceMinor:3.14159},
    ];
    const ids=orderCustomerCollectionInvoices(rows).map(x=>x.id);
    expect(ids).toEqual(["eur","usd","unsafe"]);
    expect(rows.map(x=>x.id)).toEqual(["usd","eur","unsafe"]);
  });
});
