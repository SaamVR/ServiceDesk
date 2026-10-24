import {beforeEach,describe,expect,it,vi} from "vitest";
import {requestOwnerWorkflowWhatIf} from "../../src/features/operations/owner-rule-whatif-action";
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
  sampleServiceCode:"STANDARD" as const};

function fixture(){
  const maybeSingle=vi.fn().mockResolvedValue({error:null,
    data:{id:branch,workspace_id:workspace,active:true}});
  const eq=vi.fn().mockReturnThis();
  const select=vi.fn().mockReturnValue({eq,maybeSingle});
  const from=vi.fn().mockReturnValue({select});
  const service={from};
  const value={
    actor:{role:"OWNER",workspaceId:workspace,userId:actorId},
    workspace:{id:workspace,slug},
    branchScope:{mode:"HQ",branches:[{id:branch}]},
    service,
  };
  return {value,from,select,eq,maybeSingle};
}

describe("R36 authorized real synthetic owner rule evaluator",()=>{
  beforeEach(()=>vi.clearAllMocks());

  it("uses active workspace_branches authority; returns only synthetic rule-engine evidence",async()=>{
    const s=fixture();
    vi.mocked(resolveStaffActor).mockResolvedValue({ok:true,value:s.value} as never);
    expect(await requestOwnerWorkflowWhatIf(input)).toMatchObject({
      ok:true,state:"SYNTHETIC_RULE_PREVIEW_ONLY",
      inputSource:"OWNER_HYPOTHETICAL_NOT_SAVED_EVENT",
      eventType:"QUOTE_ACCEPTED",matched:true,wouldCreateAttention:true,
      executed:false,published:false,customerMessaged:false,paymentChanged:false,
      ownerPublishStillRequired:true,
    });
    expect(s.from).toHaveBeenCalledWith("workspace_branches");
    expect(s.from).not.toHaveBeenCalledWith("branches");
    expect(s.select).toHaveBeenCalledWith("id,workspace_id,active");
    expect(s.eq).toHaveBeenCalledWith("id",branch);
    expect(s.eq).toHaveBeenCalledWith("workspace_id",workspace);
    expect(s.eq).toHaveBeenCalledWith("active",true);
    expect(s.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("rechecks selected owner branch and tenant scope before database access",async()=>{
    for(const changes of [
      {actor:{role:"DISPATCHER",workspaceId:workspace,userId:actorId}},
      {actor:{role:"OWNER",workspaceId:"other-workspace",userId:actorId}},
      {actor:{role:"OWNER",workspaceId:workspace,userId:undefined}},
      {workspace:{id:workspace,slug:"wrong-workspace"}},
      {branchScope:{mode:"HQ",branches:[]}},
      {branchScope:{mode:"BRANCH",selectedBranchId:"other",branches:[{id:branch}]}},
    ]){
      const s=fixture();
      vi.mocked(resolveStaffActor).mockResolvedValueOnce({ok:true,
        value:{...s.value,...changes}} as never);
      expect(await requestOwnerWorkflowWhatIf(input))
        .toEqual({ok:false,code:"OWNER_PREVIEW_UNAVAILABLE"});
      expect(s.from).not.toHaveBeenCalled();
    }
  });

  it("fails closed on inactive, foreign, missing or failed saved branch reads",async()=>{
    for(const result of [
      {data:{id:branch,workspace_id:workspace,active:false},error:null},
      {data:{id:branch,workspace_id:"foreign",active:true},error:null},
      {data:null,error:null},
      {data:null,error:{code:"NETWORK_ERROR"}},
    ]){
      const s=fixture();
      s.maybeSingle.mockResolvedValue(result);
      vi.mocked(resolveStaffActor).mockResolvedValueOnce({ok:true,value:s.value} as never);
      expect(await requestOwnerWorkflowWhatIf(input))
        .toEqual({ok:false,code:"OWNER_PREVIEW_UNAVAILABLE"});
    }
  });

  it("denies untrusted candidate tools and refuses to fabricate a matched preview",async()=>{
    for(const candidate of [
      {eventType:"QUOTE_ACCEPTED",severity:"WARNING",customerEmail:"secret@example.test"},
      {eventType:"QUOTE_ACCEPTED",severity:"WARNING",tool:"SEND_WHATSAPP_TEMPLATE"},
      {eventType:"QUOTE_ACCEPTED",severity:"WARNING",serviceCode:"PAY_NOW"},
    ]){
      const s=fixture();
      vi.mocked(resolveStaffActor).mockResolvedValueOnce({ok:true,value:s.value} as never);
      expect(await requestOwnerWorkflowWhatIf({...input,candidate}))
        .toEqual({ok:false,code:"OWNER_PREVIEW_UNAVAILABLE"});
    }
  });

  it("does not turn a mismatched fictional service into a successful action",async()=>{
    const s=fixture();
    vi.mocked(resolveStaffActor).mockResolvedValue({ok:true,value:s.value} as never);
    expect(await requestOwnerWorkflowWhatIf({...input,sampleServiceCode:"DEEP"}))
      .toMatchObject({ok:true,matched:false,wouldCreateAttention:false,
        executed:false,published:false,customerMessaged:false,paymentChanged:false});
  });
});