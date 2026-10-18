import {beforeEach,describe,expect,it,vi} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {parseOwnerWhatIfMatrix} from "../../src/features/operations/owner-rule-browser-proof";
import {requestOwnerWorkflowWhatIfMatrix} from "../../src/features/operations/owner-rule-whatif-action";
import {resolveStaffActor} from "../../src/features/operations/operational-product-runtime";

vi.mock("../../src/features/operations/operational-product-runtime",()=>({
  resolveStaffActor:vi.fn(),
}));
const workspace="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const actorId="33333333-3333-4333-8333-333333333333";
const slug="fictional-cleaner";
const input={workspaceSlug:slug,branchId:branch,
  candidate:{eventType:"QUOTE_ACCEPTED",severity:"WARNING",serviceCode:"STANDARD"},
};
const sampleResults=[
  {serviceCode:"STANDARD",matched:true,wouldCreateAttention:true},
  {serviceCode:"DEEP",matched:false,wouldCreateAttention:false},
  {serviceCode:"MOVE_OUT",matched:false,wouldCreateAttention:false},
];
const mockResult={ok:true,state:"SYNTHETIC_COMPARISON_ONLY",executed:false,
  published:false,customerMessaged:false,paymentChanged:false,results:sampleResults};
function auth(denied=false){
  const maybeSingle=vi.fn().mockResolvedValue(denied
    ? {data:null,error:{code:"NO_SCOPE"}}
    : {data:{id:branch,workspace_id:workspace,active:true},error:null});
  const eq=vi.fn().mockReturnThis();
  const select=vi.fn().mockReturnValue({eq,maybeSingle});
  const from=vi.fn().mockReturnValue({select});
  return {from,auth:{ok:true,value:{
    actor:{role:"OWNER",workspaceId:workspace,userId:actorId},
    workspace:{id:workspace,slug},
    branchScope:{mode:"HQ",branches:[{id:branch}]},
    service:{from},
  }}};
}
describe("R36 owner workflow hypothetical three-scenario effectiveness matrix",()=>{
  beforeEach(()=>vi.clearAllMocks());

  it("compares all three fictional services via real evaluator and three separately authorized reads",async()=>{
    const s=auth();
    vi.mocked(resolveStaffActor).mockResolvedValue(s.auth as never);
    const response=await requestOwnerWorkflowWhatIfMatrix(input);
    expect(response).toEqual(mockResult);
    expect(resolveStaffActor).toHaveBeenCalledTimes(3);
    expect(s.from).toHaveBeenCalledTimes(3);
    expect(s.from).toHaveBeenCalledWith("workspace_branches");
    expect(parseOwnerWhatIfMatrix(response)).toEqual({
      state:"SYNTHETIC_COMPARISON_ONLY",executed:false,published:false,
      customerMessaged:false,paymentChanged:false,results:sampleResults,
    });
  });
  it("fails closed when any one of the three owner reauthorization checks fails",async()=>{
    const allowed=auth();
    const denied=auth(true);
    vi.mocked(resolveStaffActor)
      .mockResolvedValueOnce(allowed.auth as never)
      .mockResolvedValueOnce(denied.auth as never)
      .mockResolvedValueOnce(allowed.auth as never);
    expect(await requestOwnerWorkflowWhatIfMatrix(input)).toEqual({
      ok:false,state:"SYNTHETIC_COMPARISON_UNAVAILABLE",
    });
  });
  it("rejects extra provider fields, duplicated samples and impossible action claims",()=>{
    const hostile=[
      {...mockResult,secret:"API_KEY"},
      {...mockResult,published:true},
      {...mockResult,executed:true},
      {...mockResult,customerMessaged:true},
      {...mockResult,results:sampleResults.slice(0,2)},
      {...mockResult,results:[sampleResults[0],sampleResults[0],sampleResults[2]]},
      {...mockResult,results:sampleResults.map(x=>({...x,contact:"private"}))},
      {...mockResult,results:[{...sampleResults[0],matched:false},...sampleResults.slice(1)]},
      {...mockResult,state:"LIVE_WORKFLOW"},
    ];
    for(const data of hostile)expect(parseOwnerWhatIfMatrix(data)).toBeNull();
  });
  it("never equates comparison to saved-rule preview or permitted publication",()=>{
    const ui=readFileSync(join(process.cwd(),
      "src/features/operations/OwnerWorkflowRuleAssistant.tsx"),"utf8");
    const source=readFileSync(join(process.cwd(),
      "src/features/operations/owner-rule-whatif-action.ts"),"utf8");
    expect(ui).toContain("Compare Standard / Deep / Move-out");
    expect(ui).toContain("Three hypothetical outcomes · no saved event");
    expect(ui).toContain("Run an individual what-if and review");
    expect(ui).toContain("setPreview(undefined)");
    expect(ui).toContain("setComparison(undefined)");
    expect(ui).toContain("modelPending.current=true");
    expect(ui).toContain("if(modelPending.current || !canGenerate");
    expect(ui).toContain("previewPending.current=true");
    expect(ui).toContain("previewPending.current=false");
    expect(ui).toContain("!suggestion || !preview || !reviewConfirmed");
    expect(source).toContain("requestOwnerWorkflowWhatIf({...input,sampleServiceCode})");
    expect(source).not.toContain("publishOperationalWorkflowVersion(");
    expect(source).not.toContain(".insert(");
  });
});