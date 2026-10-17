import { describe,expect,it } from "vitest";
import { defaultRateCard } from "../../src/domain/quote";
import { verifiedPricedOwnerBranchIds } from "../../src/features/operations/verified-owner-price-evidence";
const ws="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const book="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const service="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const good={
  books:[{branch_id:ws,rate_card_id:book,active:true,starts_at:null,ends_at:null}],
  cards:[{id:book,active:true,currency:"USD",version:"owner-reviewed-r15",
    deposit_percent:25,valid_hours:48,buffer_minutes:30,rules:{
    autoApprovalMaxTotalMinor:50000,standard:defaultRateCard.standard,
    deep:defaultRateCard.deep,moveOut:defaultRateCard.moveOut,
  }}],
  services:[{id:service,active:true,code:"STANDARD"}],
  now:Date.parse("2026-10-13T00:00:00Z"),
};
describe("verified price books for owner automation dashboard",()=>{
  it("shows a branch only with an actual priced and effective linked service",()=>{
    expect(verifiedPricedOwnerBranchIds(good)).toEqual([ws]);
  });
  it.each([
    { books:[{...good.books[0],rate_card_id:service}] },
    { books:[{...good.books[0],active:false}] },
    { books:[{...good.books[0],starts_at:"2099-01-01T00:00:00Z"}] },
    { books:[{...good.books[0],ends_at:"2020-01-01T00:00:00Z"}] },
    { cards:[] },
    { cards:[{...good.cards[0],active:false}] },
    { cards:[{...good.cards[0],currency:"GBP"}] },
    { cards:[{...good.cards[0],rules:{...good.cards[0].rules,
      standard:{...defaultRateCard.standard,baseMinor:0}}}] },
    { cards:[{...good.cards[0],rules:{...good.cards[0].rules,
      standard:{...defaultRateCard.standard,baseMinutes:0}}}] },
    { services:[{...good.services[0],active:false}] },
    { services:[{...good.services[0],code:"UNPRICED_CUSTOM"}] },
  ])("never inflates readiness with a false-positive book link (%j)",changes=>{
    expect(verifiedPricedOwnerBranchIds({...good,...changes})).toEqual([]);
  });
  it("refuses ambiguous duplicate effective branch books instead of falsely confirming quote readiness",()=>{
    expect(verifiedPricedOwnerBranchIds({
      ...good, books:[good.books[0],{...good.books[0]}],
    })).toEqual([]);
  });
});
