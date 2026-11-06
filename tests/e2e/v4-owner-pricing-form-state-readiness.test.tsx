import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OwnerCleaningPricingSetupForm } from "../../src/features/operations/OwnerCleaningPricingSetupForm";
import type { OperationalBranchScope } from "../../src/features/operations/operational-product-runtime";
import type { OwnerPricingBookProof } from "../../src/features/operations/owner-pricing-readiness";

const a={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",name:"North cleaning",code:"N",currency:"USD",timezone:"UTC",isDefault:true};
const b={id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",name:"South cleaning",code:"S",currency:"USD",timezone:"UTC",isDefault:false};
const gb={id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",name:"London cleaning",code:"L",currency:"GBP",timezone:"UTC",isDefault:false};
const scope: OperationalBranchScope={mode:"ALL",branches:[a,b,gb]};
const action=async (_formData: FormData): Promise<void> => {};
const markup=(proof?:OwnerPricingBookProof,branchScope=scope)=>
  renderToStaticMarkup(createElement(OwnerCleaningPricingSetupForm,{scope:branchScope,proof,action}));

describe("P26 owner pricing form distinguishes first-run safety states",()=>{
  it("displays unavailable evidence as an alert, not an invitation to create another branch",()=>{
    for(const proof of [undefined,{state:"UNAVAILABLE",activeBranchIds:[],existingBookBranchIds:[]} as OwnerPricingBookProof,
      {state:"VERIFIED",activeBranchIds:[]} as OwnerPricingBookProof]){
      const html=markup(proof);
      expect(html).toContain('role="alert"');
      expect(html).toContain("Saved branch pricing could not be verified");
      expect(html).toContain("No prices were saved");
      expect(html).not.toContain("Create or select an authorized USD cleaning branch");
      expect(html).not.toContain('name="setupId"');
    }
  });
  it("refuses to overwrite existing USD books, even when they are not quotable",()=>{
    const html=markup({state:"VERIFIED",activeBranchIds:[],existingBookBranchIds:[a.id,b.id]});
    expect(html).toContain("All authorized USD branches");
    expect(html).toContain("First-run setup cannot overwrite existing rates");
    expect(html).not.toContain('name="setupId"');
  });
  it("still offers an owner-entered price form for the selected genuinely unpriced USD branch",()=>{
    const chosen:OperationalBranchScope={...scope,mode:"BRANCH",selectedBranchId:b.id};
    const html=markup({state:"VERIFIED",activeBranchIds:[a.id],existingBookBranchIds:[a.id]},chosen);
    expect(html).toContain("First-run owner cleaning pricing");
    expect(html).toContain("South cleaning");
    expect(html).not.toContain("North cleaning");
    expect(html).toContain('name="setupId"');
    expect(html).toContain("Enter actual price");
  });
  it("requires positive base prices and base minutes while permitting zero add-ons",()=>{
    const html=markup({state:"VERIFIED",activeBranchIds:[],existingBookBranchIds:[]});
    const input=(name:string)=>{
      const tag=html.match(new RegExp('<input[^>]*name="'+name+'"[^>]*>'))?.[0];
      expect(tag,name).toBeDefined();
      return tag!;
    };
    const accepts=(tag:string,value:string)=>{
      const pattern=tag.match(/pattern="([^"]+)"/)?.[1];
      expect(pattern).toBeDefined();
      return new RegExp("^(?:"+pattern+")$").test(value);
    };
    for(const prefix of ["standard","deep","moveOut"]){
      const base=input(prefix+"Base");
      expect(accepts(base,"0")).toBe(false);
      expect(accepts(base,"0.00")).toBe(false);
      expect(accepts(base,"0.01")).toBe(true);
      expect(accepts(base,"125.25")).toBe(true);
      expect(input(prefix+"BaseMinutes")).toContain('min="1"');
      expect(accepts(input(prefix+"Bedroom"),"0")).toBe(true);
      expect(input(prefix+"BedroomMinutes")).toContain('min="0"');
    }
    expect(accepts(input("moveOutOven"),"0")).toBe(true);
  });

  it("does not invent an eligible branch when the owner has only unsupported currency",()=>{
    const other:OperationalBranchScope={mode:"ALL",branches:[gb]};
    const html=markup({state:"VERIFIED",activeBranchIds:[],existingBookBranchIds:[]},other);
    expect(html).toContain("Create or select an authorized USD cleaning branch");
    expect(html).not.toContain('name="setupId"');
  });
});
